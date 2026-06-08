import pytest
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.asset import Asset, AssetLog
from app.models.user import User, Department
from app.services.asset_service import AssetService
from app.routers.assets import (
    register_asset,
    update_asset,
    verify_asset,
    get_dashboard_stats,
    import_assets
)

@pytest.mark.asyncio
async def test_manual_asset_creation_with_extra_fields(db_session):
    """Test registering an asset with Remarks and Asset Source fields."""
    db_session.commit = db_session.flush

    # Retrieve HOD user
    user_q = await db_session.execute(
        select(User).options(selectinload(User.role)).where(User.email == "hod.cse@nitt.edu")
    )
    hod_user = user_q.scalar_one()

    # Manual registration payload
    body = {
        "name": "Supercomputer node",
        "legacy_asset_tag": "LEG-CSE-NODE-01",
        "category": "computer",
        "department_id": hod_user.department_id,
        "year": "2026",
        "remarks": "Purchased from research grant",
        "asset_source": "iris",
        "unit_cost": "150000"
    }

    response = await register_asset(body, db=db_session, user=hod_user)
    assert response["message"] == "Asset manually registered successfully"
    asset_id = response["id"]

    # Verify database entry
    res = await db_session.execute(select(Asset).where(Asset.id == asset_id))
    asset = res.scalar_one()
    assert asset.name == "Supercomputer node"
    assert asset.remarks == "Purchased from research grant"
    assert asset.asset_source == "iris"
    assert asset.unit_cost == 150000.0
    assert asset.is_verified is False

    # Check that registration log is written
    log_q = await db_session.execute(select(AssetLog).where(AssetLog.asset_id == asset_id))
    logs = log_q.scalars().all()
    assert len(logs) == 1
    assert logs[0].action == "asset_registered"
    assert logs[0].new_value["remarks"] == "Purchased from research grant"
    assert logs[0].new_value["asset_source"] == "iris"


@pytest.mark.asyncio
async def test_asset_update_and_audit_log(db_session):
    """Test updating fields on an existing asset and ensuring audit logs capture old and new values."""
    db_session.commit = db_session.flush

    user_q = await db_session.execute(
        select(User).options(selectinload(User.role)).where(User.email == "hod.cse@nitt.edu")
    )
    hod_user = user_q.scalar_one()

    # Create initial asset
    svc = AssetService(db_session)
    asset = await svc.register_asset({
        "name": "Projector B1",
        "legacy_asset_tag": "LEG-PROJ-B1",
        "category": "lab_equipment",
        "department_id": hod_user.department_id,
        "year": "2026",
        "remarks": "Old remarks"
    }, hod_user)
    await db_session.flush()

    # Update asset fields
    update_body = {
        "name": "Projector B1 Updated",
        "remarks": "New remarks",
        "building": "CSE Annex",
        "room": "Seminar Hall",
        "unit_cost": 45000.0
    }

    res = await update_asset(asset.id, update_body, db=db_session, user=hod_user)
    assert res["message"] == "Asset updated successfully"

    # Refresh and check values
    await db_session.refresh(asset)
    assert asset.name == "Projector B1 Updated"
    assert asset.remarks == "New remarks"
    assert asset.building == "CSE Annex"
    assert asset.room == "Seminar Hall"
    assert asset.unit_cost == 45000.0

    # Verify log entry
    log_q = await db_session.execute(
        select(AssetLog)
        .where(AssetLog.asset_id == asset.id, AssetLog.action == "asset_updated")
    )
    log = log_q.scalar_one()
    assert log.old_value["remarks"] == "Old remarks"
    assert log.new_value["remarks"] == "New remarks"
    assert log.new_value["building"] == "CSE Annex"


@pytest.mark.asyncio
async def test_asset_verification_and_audit_log(db_session):
    """Test physical asset verification and verification logging."""
    db_session.commit = db_session.flush

    user_q = await db_session.execute(
        select(User).options(selectinload(User.role)).where(User.email == "hod.cse@nitt.edu")
    )
    hod_user = user_q.scalar_one()

    svc = AssetService(db_session)
    asset = await svc.register_asset({
        "name": "Lab Desk 12",
        "legacy_asset_tag": "LEG-DESK-12",
        "category": "furniture",
        "department_id": hod_user.department_id,
        "year": "2026"
    }, hod_user)
    await db_session.flush()

    assert asset.is_verified is False
    assert asset.verified_at is None

    # Verify the asset
    res = await verify_asset(asset.id, db=db_session, user=hod_user)
    assert res["is_verified"] is True

    # Check updated fields
    await db_session.refresh(asset)
    assert asset.is_verified is True
    assert asset.verified_at is not None

    # Check audit log
    log_q = await db_session.execute(
        select(AssetLog)
        .where(AssetLog.asset_id == asset.id, AssetLog.action == "asset_verified")
    )
    log = log_q.scalar_one()
    assert log.old_value["is_verified"] is False
    assert log.new_value["is_verified"] is True


@pytest.mark.asyncio
async def test_csv_import_atomicity_and_remarks(db_session):
    """Test that CSV import correctly parses the new schema and is fully atomic (rolls back on failure)."""
    db_session.commit = db_session.flush

    user_q = await db_session.execute(
        select(User).options(selectinload(User.role)).where(User.email == "admin@nitt.edu")
    )
    admin_user = user_q.scalar_one()

    svc = AssetService(db_session)

    # 1. Valid CSV content (fully qualified with all 24 required fields)
    headers = "purchase_year,existing_asset_no,name,category,asset_source,department,fund_source,unit_cost,quantity,purchase_date,warranty_expiry,supplier_name,bill_number,supplier_address,bill_date,delivery_date,stock_register_volume,stock_register_page,building,room,custodian,serial_number,condition,remarks"
    row1 = "2026,CSV-TAG-01,Workstation Pro,computer,legacy,CSE,plan_fund,150000,1,2026-01-10,2029-01-10,USAM,USAM/2026/10,123 Salai Chennai,2026-01-05,2026-01-10,Vol 1,Page 12,CSE Block,Lab 1,Dr. Kumar,SN-123456,working,Imported via script"
    valid_csv = f"{headers}\n{row1}\n"

    with pytest.raises(HTTPException) as exc_info:
        await svc.import_assets_csv(valid_csv, admin_user)
    
    assert exc_info.value.status_code == 403
    assert "disabled" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_dashboard_stats(db_session):
    """Test dashboard stats endpoint calculation for department users."""
    db_session.commit = db_session.flush

    user_q = await db_session.execute(
        select(User).options(selectinload(User.role)).where(User.email == "hod.cse@nitt.edu")
    )
    hod_user = user_q.scalar_one()

    # Clear existing assets for CSE department to have a clean starting point
    from app.models.asset import Asset
    await db_session.execute(
        select(Asset).where(Asset.department_id == hod_user.department_id)
    )
    
    # Register 3 assets: 2 verified, 1 pending; distinct conditions & categories
    svc = AssetService(db_session)
    a1 = await svc.register_asset({
        "name": "PC 1",
        "legacy_asset_tag": "CSE-STAT-PC1",
        "category": "computer",
        "condition": "working",
        "department_id": hod_user.department_id,
        "year": "2026"
    }, hod_user)
    a2 = await svc.register_asset({
        "name": "PC 2",
        "legacy_asset_tag": "CSE-STAT-PC2",
        "category": "computer",
        "condition": "damaged",
        "department_id": hod_user.department_id,
        "year": "2026"
    }, hod_user)
    a3 = await svc.register_asset({
        "name": "Table 1",
        "legacy_asset_tag": "CSE-STAT-TB1",
        "category": "furniture",
        "condition": "working",
        "department_id": hod_user.department_id,
        "year": "2026"
    }, hod_user)
    
    await db_session.flush()

    # Verify a1 and a3
    a1.is_verified = True
    a3.is_verified = True
    await db_session.flush()

    # Fetch stats
    stats = await get_dashboard_stats(db=db_session, user=hod_user)
    
    # Assert values
    assert stats["total_assets"] >= 3
    assert stats["pending_verification"] >= 1
    assert stats["by_category"].get("computer") >= 2
    assert stats["by_category"].get("furniture") >= 1
    assert stats["by_condition"].get("working") >= 2
    assert stats["by_condition"].get("damaged") >= 1
    assert len(stats["recent_assets"]) <= 5


@pytest.mark.asyncio
async def test_asset_sl_no_and_quantity_and_supplier_fields(db_session):
    """Test sl_no generation, quantity defaults, and supplier/bill/stock details persistence."""
    db_session.commit = db_session.flush

    # Retrieve HOD user
    user_q = await db_session.execute(
        select(User).options(selectinload(User.role)).where(User.email == "hod.cse@nitt.edu")
    )
    hod_user = user_q.scalar_one()

    # 1. Register first asset - quantity omitted (should default to 1)
    body1 = {
        "name": "Projector Screen A",
        "legacy_asset_tag": "LEG-CSE-PROJ-A",
        "category": "lab_equipment",
        "department_id": hod_user.department_id,
        "year": "2026",
        "supplier_name": "Nitt Suppliers Ltd",
        "supplier_address": "123 Campus Road\nTrichy",
        "bill_number": "BILL/2026/001",
        "bill_date": "2026-06-01",
        "delivery_date": "2026-06-03",
        "stock_register_volume": "Vol 2",
        "stock_register_page": "Page 45",
        "remarks": "Form modal tests",
        "asset_source": "iris",
        "unit_cost": "25000"
    }

    response1 = await register_asset(body1, db=db_session, user=hod_user)
    assert response1["message"] == "Asset manually registered successfully"
    asset1_id = response1["id"]

    # Retrieve and verify asset 1
    res1 = await db_session.execute(select(Asset).where(Asset.id == asset1_id))
    asset1 = res1.scalar_one()
    
    assert asset1.quantity == 1  # default value
    assert asset1.supplier_name == "Nitt Suppliers Ltd"
    assert asset1.supplier_address == "123 Campus Road\nTrichy"
    assert asset1.bill_number == "BILL/2026/001"
    assert asset1.bill_date.isoformat() == "2026-06-01"
    assert asset1.delivery_date.isoformat() == "2026-06-03"
    assert asset1.stock_register_volume == "Vol 2"
    assert asset1.stock_register_page == "Page 45"

    # 2. Register second asset - quantity specified as 5
    body2 = {
        "name": "Lab Chairs",
        "legacy_asset_tag": "LEG-CSE-CH-1",
        "category": "furniture",
        "department_id": hod_user.department_id,
        "year": "2026",
        "quantity": 5,
        "supplier_name": "Furniture Corp",
        "bill_number": "BILL/FC/99",
        "bill_date": "2026-06-02",
        "delivery_date": "2026-06-05",
        "unit_cost": "1500"
    }

    response2 = await register_asset(body2, db=db_session, user=hod_user)
    asset2_id = response2["id"]

    res2 = await db_session.execute(select(Asset).where(Asset.id == asset2_id))
    asset2 = res2.scalar_one()
    
    assert asset2.quantity == 5
    assert asset2.supplier_name == "Furniture Corp"
    assert asset2.bill_number == "BILL/FC/99"

    # 3. Update asset and check details update correctly
    update_body = {
        "name": "Lab Chairs Premium",
        "quantity": 6,
        "supplier_name": "Furniture Corp Updated"
    }
    await update_asset(asset2_id, update_body, db=db_session, user=hod_user)
    
    await db_session.refresh(asset2)
    assert asset2.name == "Lab Chairs Premium"
    assert asset2.quantity == 6
    assert asset2.supplier_name == "Furniture Corp Updated"

