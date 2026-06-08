"""Asset service: creates assets, logs movements and condition changes, handles disposal."""
from datetime import datetime
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.models.asset import Asset, AssetMovement, AssetLog, DisposalStatus
from app.models.inventory import DeliveryItem, DeptAssetLog
from app.models.user import User
from app.services.qr_service import QrService


class AssetService:
    def __init__(self, db: AsyncSession):
        """Initialize AssetService with db session and QR service."""
        self.db = db
        self.qr_svc = QrService()

    async def _get_tag_sequences(self, dept_code: str, count: int) -> list[int]:
        """Dynamically create a database sequence for a department if not exists, and fetch a batch of next sequence numbers."""
        if count <= 0:
            return []
        clean_dept = "".join(c for c in dept_code.lower() if c.isalnum())
        try:
            async with self.db.begin_nested():
                await self.db.execute(text(f"CREATE SEQUENCE IF NOT EXISTS asset_seq_{clean_dept} START 1;"))
        except Exception:
            pass
        res = await self.db.execute(
            text(f"SELECT nextval('asset_seq_{clean_dept}') FROM generate_series(1, :qty);"),
            {"qty": count}
        )
        return [r[0] for r in res.all()]

    async def create_assets_from_grn(self, delivery_item: DeliveryItem, dept_log: DeptAssetLog) -> list[Asset]:
        """Auto-create assets after GRN verification. One asset per serial number."""
        from app.models.user import Department
        dept_q = await self.db.execute(
            select(Department).where(Department.id == delivery_item.delivery.department_id)
        )
        dept = dept_q.scalar_one()
        dept_code = dept.short_code
        
        current_date = datetime.utcnow().date()
        year_suffix = str(current_date.year)[-2:]

        serial_numbers = dept_log.serial_numbers or []
        quantity = dept_log.quantity
        assets = []

        # Pre-generate ALL sequence numbers in a single DB trip to avoid in-loop sequence queries
        seq_values = await self._get_tag_sequences(dept_code, quantity)

        for i in range(quantity):
            seq = seq_values[i]
            asset_tag = f"NIT-{dept_code}-{year_suffix}-{seq:03d}"
            serial = serial_numbers[i] if i < len(serial_numbers) else None

            qr_url = self.qr_svc.generate(asset_tag)

            asset = Asset(
                asset_tag=asset_tag,
                name=delivery_item.name,
                category=delivery_item.category,
                department_id=delivery_item.delivery.department_id,
                building=dept_log.building,
                room=dept_log.room,
                custodian=dept_log.custodian_name,
                serial_number=serial,
                condition=dept_log.condition if dept_log.condition in ("working", "damaged") else "working",
                disposal_status=DisposalStatus.ACTIVE,
                qr_code_url=qr_url,
                purchase_date=datetime.utcnow().date(),
                unit_cost=delivery_item.unit_price,
                delivery_item_id=delivery_item.id,
            )
            self.db.add(asset)
            await self.db.flush()

            # Initial asset log
            log = AssetLog(
                asset_id=asset.id,
                action="asset_created",
                performed_by_id=dept_log.logged_by_id,
                old_value=None,
                new_value={"asset_tag": asset_tag, "condition": asset.condition},
                performed_at=datetime.utcnow(),
            )
            self.db.add(log)
            assets.append(asset)

        await self.db.flush()
        return assets

    async def register_asset(self, data: dict, user: User) -> Asset:
        """Manually register a department asset."""
        from app.models.user import Department
        
        # Determine department_id
        dept_id = data.get("department_id") or user.department_id
        if not dept_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Department ID is required")
            
        # Get department short code
        dept_q = await self.db.execute(select(Department).where(Department.id == dept_id))
        dept = dept_q.scalar_one_or_none()
        if not dept:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Invalid department")
        dept_code = dept.short_code
        
        # Get selected year
        selected_year = data.get("year")
        if selected_year:
            try:
                year_val = int(selected_year)
                year_suffix = f"{year_val % 100:02d}"
            except (ValueError, TypeError):
                year_suffix = str(datetime.utcnow().date().year)[-2:]
        else:
            year_suffix = str(datetime.utcnow().date().year)[-2:]
            
        # Auto-generate next asset tag sequence using Postgres sequence (atomic & race-free)
        seq_list = await self._get_tag_sequences(dept_code, 1)
        seq = seq_list[0]
        asset_tag = f"NIT-{dept_code}-{year_suffix}-{seq:03d}"
        
        # Check if asset_tag is unique (should be since sequence works, but safe check)
        check_q = await self.db.execute(select(Asset).where(Asset.asset_tag == asset_tag))
        if check_q.scalar_one_or_none():
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Generated asset tag already exists")
            
        # Parse optional dates
        purchase_date = None
        if data.get("purchase_date"):
            purchase_date = datetime.strptime(data["purchase_date"], "%Y-%m-%d").date()
            
        warranty_expiry = None
        if data.get("warranty_expiry"):
            warranty_expiry = datetime.strptime(data["warranty_expiry"], "%Y-%m-%d").date()
            
        bill_date = None
        if data.get("bill_date"):
            bill_date = datetime.strptime(data["bill_date"], "%Y-%m-%d").date()

        delivery_date = None
        if data.get("delivery_date"):
            delivery_date = datetime.strptime(data["delivery_date"], "%Y-%m-%d").date()

        # Generate QR code
        qr_url = self.qr_svc.generate(asset_tag)
        
        asset = Asset(
            asset_tag=asset_tag,
            legacy_asset_tag=data.get("legacy_asset_tag"),
            fund_source=data.get("fund_source"),
            name=data["name"],
            category=data["category"],
            department_id=dept_id,
            building=data.get("building"),
            room=data.get("room"),
            custodian=data.get("custodian"),
            serial_number=data.get("serial_number"),
            condition=data.get("condition") or "working",
            disposal_status=DisposalStatus.ACTIVE,
            qr_code_url=qr_url,
            purchase_date=purchase_date,
            unit_cost=float(data["unit_cost"]) if data.get("unit_cost") else None,
            warranty_expiry=warranty_expiry,
            remarks=data.get("remarks"),
            asset_source=data.get("asset_source") or "legacy",
            # New fields
            quantity=int(data["quantity"]) if data.get("quantity") is not None else 1,
            supplier_name=data.get("supplier_name"),
            supplier_address=data.get("supplier_address"),
            bill_number=data.get("bill_number"),
            bill_date=bill_date,
            delivery_date=delivery_date,
            stock_register_volume=data.get("stock_register_volume"),
            stock_register_page=data.get("stock_register_page"),
        )
        self.db.add(asset)
        await self.db.flush()
        
        # Log manual registration
        log = AssetLog(
            asset_id=asset.id,
            action="asset_registered",
            performed_by_id=user.id,
            old_value=None,
            new_value={
                "asset_tag": asset_tag,
                "legacy_asset_tag": asset.legacy_asset_tag,
                "fund_source": asset.fund_source,
                "condition": asset.condition,
                "remarks": asset.remarks,
                "asset_source": asset.asset_source,
                "quantity": asset.quantity,
                "supplier_name": asset.supplier_name,
                "supplier_address": asset.supplier_address,
                "bill_number": asset.bill_number,
                "bill_date": asset.bill_date.isoformat() if asset.bill_date else None,
                "delivery_date": asset.delivery_date.isoformat() if asset.delivery_date else None,
                "stock_register_volume": asset.stock_register_volume,
                "stock_register_page": asset.stock_register_page,
            },
            performed_at=datetime.utcnow(),
        )
        self.db.add(log)
        await self.db.flush()
        return asset

    async def update_condition(self, asset_id: int, new_condition: str, user: User) -> Asset:
        """Update the condition profile of a registered asset and log it."""
        result = await self.db.execute(select(Asset).where(Asset.id == asset_id))
        asset = result.scalar_one()
        old_condition = asset.condition
        asset.condition = new_condition
        log = AssetLog(
            asset_id=asset.id,
            action="condition_updated",
            performed_by_id=user.id,
            old_value={"condition": old_condition},
            new_value={"condition": new_condition},
        )
        self.db.add(log)
        await self.db.flush()
        return asset

    async def move_asset(self, asset_id: int, to_building: str, to_room: str, user: User, reason: Optional[str]) -> Asset:
        """Log movements of assets between buildings and rooms."""
        result = await self.db.execute(select(Asset).where(Asset.id == asset_id))
        asset = result.scalar_one()
        movement = AssetMovement(
            asset_id=asset.id,
            from_building=asset.building,
            from_room=asset.room,
            to_building=to_building,
            to_room=to_room,
            moved_by_id=user.id,
            reason=reason,
        )
        log = AssetLog(
            asset_id=asset.id,
            action="asset_moved",
            performed_by_id=user.id,
            old_value={"building": asset.building, "room": asset.room},
            new_value={"building": to_building, "room": to_room},
        )
        asset.building = to_building
        asset.room = to_room
        self.db.add(movement)
        self.db.add(log)
        await self.db.flush()
        return asset

    async def flag_disposal(self, asset_id: int, user: User) -> Asset:
        """Flag an asset as ready/pending for institutional disposal."""
        result = await self.db.execute(select(Asset).where(Asset.id == asset_id))
        asset = result.scalar_one()
        asset.disposal_status = DisposalStatus.PENDING_DISPOSAL
        log = AssetLog(
            asset_id=asset.id,
            action="disposal_flagged",
            performed_by_id=user.id,
            old_value={"disposal_status": "active"},
            new_value={"disposal_status": "pending_disposal"},
        )
        self.db.add(log)
        await self.db.flush()
        return asset

    async def confirm_disposal(self, asset_id: int, admin_user: User) -> Asset:
        """Confirm final disposal of an asset and flag status as disposed."""
        result = await self.db.execute(select(Asset).where(Asset.id == asset_id))
        asset = result.scalar_one()
        asset.disposal_status = DisposalStatus.DISPOSED
        log = AssetLog(
            asset_id=asset.id,
            action="disposal_confirmed",
            performed_by_id=admin_user.id,
            old_value={"disposal_status": "pending_disposal"},
            new_value={"disposal_status": "disposed"},
        )
        self.db.add(log)
        await self.db.flush()
        return asset

    async def delete_asset(self, asset_id: int, user: User) -> None:
        """Permanently delete an asset from the system."""
        result = await self.db.execute(select(Asset).where(Asset.id == asset_id))
        asset = result.scalar_one_or_none()
        if not asset:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Asset not found")
        
        # Permission check: HODs can only delete assets belonging to their department. Admins can delete any.
        if user.role.group_key == "hod" and asset.department_id != user.department_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=403, detail="Access denied")
            
        await self.db.delete(asset)
        await self.db.flush()

    async def import_assets_csv(self, file_content: str, user: User) -> dict:
        """Import a batch of assets from a CSV file atomically with complete rollback support."""
        import csv
        import io
        from fastapi import HTTPException
        from app.models.user import Department
        
        # Determine user group permission
        raise HTTPException(status_code=403, detail="Asset import is disabled")
        is_admin = False
        is_hod = False

        # Load departments for lookup
        dept_result = await self.db.execute(select(Department))
        dept_list = dept_result.scalars().all()
        dept_by_code = {d.short_code.upper(): d for d in dept_list}
        dept_by_id = {d.id: d for d in dept_list}

        reader = csv.reader(io.StringIO(file_content.strip()))
        rows = list(reader)
        if not rows:
            raise HTTPException(status_code=400, detail="Empty CSV file")
        
        headers = [h.strip().lower().replace(" ", "_").replace("-", "_") for h in rows[0]]
        
        # Helper to get column index by possible header aliases
        def get_col_index(aliases):
            for alias in aliases:
                normalized = alias.lower().replace(" ", "_").replace("-", "_")
                if normalized in headers:
                    return headers.index(normalized)
            return -1

        idx_year = get_col_index(["purchase_year", "year", "asset_year"])
        idx_legacy = get_col_index(["existing_asset_no", "existing_asset_number", "asset_tag", "legacy_asset_tag", "legacy_tag"])
        idx_name = get_col_index(["asset_name", "name"])
        idx_category = get_col_index(["category"])
        idx_asset_source = get_col_index(["asset_source", "source", "asset_type"])
        idx_fund = get_col_index(["fund_source", "funding", "funding_type", "fund_type"])
        idx_cost = get_col_index(["unit_cost", "cost", "price", "unit_price"])
        idx_quantity = get_col_index(["quantity", "qty"])
        idx_purchase = get_col_index(["purchase_date", "purchase_day"])
        idx_warranty = get_col_index(["warranty_expiry", "warranty_date"])
        idx_supplier_name = get_col_index(["supplier_name", "supplier", "vendor_name", "vendor"])
        idx_bill_number = get_col_index(["bill_number", "bill_no", "invoice_number", "invoice_no"])
        idx_supplier_address = get_col_index(["supplier_address", "supplier_addr", "vendor_address"])
        idx_bill_date = get_col_index(["bill_date", "bill_day", "invoice_date"])
        idx_delivery_date = get_col_index(["delivery_date", "delivery_day"])
        idx_stock_register_volume = get_col_index(["stock_register_volume", "stock_volume", "register_volume"])
        idx_stock_register_page = get_col_index(["stock_register_page", "stock_page", "register_page"])
        idx_building = get_col_index(["building", "location_building"])
        idx_room = get_col_index(["room", "location_room"])
        idx_custodian = get_col_index(["custodian", "lab_in_charge", "in_charge"])
        idx_serial = get_col_index(["serial_number", "serial", "serial_no", "manufacturer_serial"])
        idx_condition = get_col_index(["condition"])
        idx_remarks = get_col_index(["remarks", "remarks_field", "notes"])
        idx_dept = get_col_index(["department", "dept", "department_code", "dept_code", "department_id"])

        required_columns = {
            "purchase_year": idx_year,
            "existing_asset_no": idx_legacy,
            "name": idx_name,
            "category": idx_category,
            "asset_source": idx_asset_source,
            "department": idx_dept,
            "fund_source": idx_fund,
            "unit_cost": idx_cost,
            "quantity": idx_quantity,
            "purchase_date": idx_purchase,
            "warranty_expiry": idx_warranty,
            "supplier_name": idx_supplier_name,
            "bill_number": idx_bill_number,
            "supplier_address": idx_supplier_address,
            "bill_date": idx_bill_date,
            "delivery_date": idx_delivery_date,
            "stock_register_volume": idx_stock_register_volume,
            "stock_register_page": idx_stock_register_page,
            "building": idx_building,
            "room": idx_room,
            "custodian": idx_custodian,
            "serial_number": idx_serial,
            "condition": idx_condition,
            "remarks": idx_remarks
        }
        
        missing_headers = [col for col, idx in required_columns.items() if idx == -1]
        if missing_headers:
            raise HTTPException(
                status_code=400, 
                detail=f"CSV Import Failed: Missing required columns: {', '.join(missing_headers)}"
            )

        imported_count = 0
        errors = []

        for i, row in enumerate(rows[1:], start=2):
            if not row or not any(field.strip() for field in row):
                continue  # Skip empty rows

            # Helper to retrieve raw column value
            def val(idx):
                if idx < len(row):
                    return row[idx].strip()
                return ""

            legacy_tag = val(idx_legacy)
            asset_name = val(idx_name)

            # Skip template notes/hints rows (row 2 in the template = notes row)
            if legacy_tag.lower().startswith("e.g.") or legacy_tag.lower().startswith("(required)"):
                continue
            if asset_name.lower().startswith("e.g."):
                continue

            row_errors = []

            # 1. Retrieve all raw values
            year_str = val(idx_year)
            cat_str = val(idx_category)
            source_raw = val(idx_asset_source)
            dept_val = val(idx_dept)
            fund_val = val(idx_fund)
            cost_str = val(idx_cost)
            qty_str = val(idx_quantity)
            purchase_str = val(idx_purchase)
            warranty_str = val(idx_warranty)
            supplier_name = val(idx_supplier_name)
            bill_number = val(idx_bill_number)
            supplier_address = val(idx_supplier_address)
            bill_date_str = val(idx_bill_date)
            delivery_date_str = val(idx_delivery_date)
            stock_volume = val(idx_stock_register_volume)
            stock_page = val(idx_stock_register_page)
            building = val(idx_building)
            room = val(idx_room)
            custodian = val(idx_custodian)
            serial_number = val(idx_serial)
            cond_str = val(idx_condition)
            remarks = val(idx_remarks)

            # 2. Check for empty fields (make all 24 columns mandatory)
            fields_to_check = {
                "purchase_year": year_str,
                "existing_asset_no": legacy_tag,
                "name": asset_name,
                "category": cat_str,
                "asset_source": source_raw,
                "department": dept_val,
                "fund_source": fund_val,
                "unit_cost": cost_str,
                "quantity": qty_str,
                "purchase_date": purchase_str,
                "warranty_expiry": warranty_str,
                "supplier_name": supplier_name,
                "bill_number": bill_number,
                "supplier_address": supplier_address,
                "bill_date": bill_date_str,
                "delivery_date": delivery_date_str,
                "stock_register_volume": stock_volume,
                "stock_register_page": stock_page,
                "building": building,
                "room": room,
                "custodian": custodian,
                "serial_number": serial_number,
                "condition": cond_str,
                "remarks": remarks
            }

            for field_name, value in fields_to_check.items():
                if not value:
                    row_errors.append(f"Field '{field_name}' is empty")

            # 3. Validate values if no blank errors so far
            if not row_errors:
                # Validate Purchase Year
                year_val = None
                try:
                    year_val = int(year_str)
                    if not (1990 <= year_val <= 2100):
                        row_errors.append(f"Purchase Year must be between 1990 and 2100 (got '{year_str}')")
                except ValueError:
                    row_errors.append(f"Purchase Year must be a valid integer (got '{year_str}')")

                # Validate Category
                cat_val = cat_str.lower().strip()
                if cat_val not in ("lab_equipment", "furniture", "computer", "other"):
                    row_errors.append(f"Category must be one of 'lab_equipment', 'furniture', 'computer', 'other' (got '{cat_str}')")

                # Validate Asset Source
                asset_source_val = source_raw.lower().strip()
                if asset_source_val not in ("legacy", "iris"):
                    row_errors.append(f"Asset Source must be one of 'legacy', 'iris' (got '{source_raw}')")

                # Validate Department
                target_dept = None
                if is_hod:
                    target_dept = dept_by_id.get(user.department_id)
                    if target_dept and dept_val.upper() != target_dept.short_code.upper():
                        row_errors.append(f"Department '{dept_val}' does not match your authorized department '{target_dept.short_code}'")
                elif is_admin:
                    target_dept = dept_by_code.get(dept_val.upper())
                    if not target_dept:
                        try:
                            target_dept = dept_by_id.get(int(dept_val))
                        except ValueError:
                            pass
                    if not target_dept:
                        row_errors.append(f"Invalid department code or ID '{dept_val}'")

                # Validate Fund Source
                fund_val_clean = fund_val.lower().strip()
                valid_funds = ("plan_fund", "non_plan_fund", "research_fund", "consultancy_fund", "dept_development_fund", "others")
                if fund_val_clean not in valid_funds:
                    row_errors.append(f"Funding Source must be one of {', '.join(valid_funds)} (got '{fund_val}')")

                # Validate Unit Cost
                cost_val = None
                try:
                    cleaned_cost = cost_str.replace("₹", "").replace(",", "").strip()
                    cost_val = float(cleaned_cost)
                    if cost_val < 0:
                        row_errors.append("Unit Cost cannot be negative")
                except ValueError:
                    row_errors.append(f"Unit Cost must be a valid number (got '{cost_str}')")

                # Validate Quantity
                qty_val = None
                try:
                    qty_val = int(qty_str)
                    if qty_val < 1:
                        row_errors.append("Quantity must be at least 1")
                except ValueError:
                    row_errors.append(f"Quantity must be a valid integer (got '{qty_str}')")

                # Validate Condition
                cond_val = cond_str.lower().strip()
                if cond_val not in ("working", "damaged", "under_repair", "obsolete"):
                    row_errors.append(f"Condition must be one of 'working', 'damaged', 'under_repair', 'obsolete' (got '{cond_str}')")

                # Validate Dates
                def parse_date(date_str, field_name):
                    parsed = None
                    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y", "%d/%m/%Y"):
                        try:
                            parsed = datetime.strptime(date_str, fmt).date()
                            break
                        except ValueError:
                            continue
                    if not parsed:
                        row_errors.append(f"{field_name} must be a valid date in YYYY-MM-DD format (got '{date_str}')")
                    return parsed

                purchase_date = parse_date(purchase_str, "Purchase Date")
                warranty_expiry = parse_date(warranty_str, "Warranty Expiry")
                bill_date = parse_date(bill_date_str, "Bill Date")
                delivery_date = parse_date(delivery_date_str, "Delivery Date")

                # Check unique tag uniqueness in DB
                legacy_check_q = await self.db.execute(select(Asset).where(Asset.legacy_asset_tag == legacy_tag))
                if legacy_check_q.scalar_one_or_none():
                    row_errors.append(f"Existing Asset Number '{legacy_tag}' is already registered in the system")

            if row_errors:
                errors.append(f"Row {i}: {'; '.join(row_errors)}")
                continue

            # All validation passed! Call register_asset dict-style
            try:
                await self.register_asset({
                    "year": year_val,
                    "legacy_asset_tag": legacy_tag,
                    "fund_source": fund_val_clean,
                    "name": asset_name,
                    "category": cat_val,
                    "department_id": target_dept.id,
                    "building": building,
                    "room": room,
                    "custodian": custodian,
                    "serial_number": serial_number,
                    "condition": cond_val,
                    "purchase_date": purchase_date.strftime("%Y-%m-%d") if purchase_date else None,
                    "unit_cost": cost_val,
                    "warranty_expiry": warranty_expiry.strftime("%Y-%m-%d") if warranty_expiry else None,
                    "remarks": remarks,
                    "asset_source": asset_source_val,
                    "quantity": qty_val,
                    "supplier_name": supplier_name,
                    "supplier_address": supplier_address,
                    "bill_number": bill_number,
                    "bill_date": bill_date.strftime("%Y-%m-%d") if bill_date else None,
                    "delivery_date": delivery_date.strftime("%Y-%m-%d") if delivery_date else None,
                    "stock_register_volume": stock_volume,
                    "stock_register_page": stock_page,
                }, user)
                imported_count += 1
            except Exception as e:
                errors.append(f"Row {i}: Database insertion failed: {str(e)}")

        if errors:
            # Rollback to avoid partial uploads
            await self.db.rollback()
            raise HTTPException(status_code=400, detail={"message": "CSV Import Failed", "errors": errors})
        
        return {"message": f"Successfully imported {imported_count} assets."}
