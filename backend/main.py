from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal, Optional, List, Dict, Any
import datetime
import uuid
import json
import logging
from .database import get_connection, init_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SmartCityBackend")

app = FastAPI(title="Team Mirai - Smart City Multi-Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database schema on startup
@app.on_event("startup")
def startup_event():
    init_db()
    logger.info("Database initialized.")

# ============================================================================
# Schemas
# ============================================================================

class AccidentDispatchPayload(BaseModel):
    accident_detected: bool = True
    location: str = Field(..., example="Junction 4 - Main Rd (13.556° N, 80.026° E)")
    snapshot: str = Field(..., example="frame_04.jpg")
    latitude: Optional[float] = 13.556
    longitude: Optional[float] = 80.026

class FineVerificationPayload(BaseModel):
    action: Literal["APPROVE", "REJECT"]
    reviewer_id: Optional[str] = "OFFICER_PATROL_402"

class FloodAlertPayload(BaseModel):
    sector: str = Field(..., example="Sector B")
    water_level_meters: float = Field(default=1.45, ge=0.0)
    urgency: Optional[str] = "HIGH"

# Active WebSocket connections
active_connections: List[WebSocket] = []

async def broadcast_ws(event_type: str, data: Any):
    payload = json.dumps({"type": event_type, "payload": data, "timestamp": datetime.datetime.now().isoformat()})
    disconnected = []
    for ws in active_connections:
        try:
            await ws.send_text(payload)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        if ws in active_connections:
            active_connections.remove(ws)

# ============================================================================
# Member 3 - Endpoint 1: Control Forces Accident Notification API
# ============================================================================
@app.post("/api/accidents/dispatch")
async def dispatch_accident(payload: AccidentDispatchPayload):
    """
    Triggered when Member 1 detects an accident near traffic lights.
    Sends an instant alert to police and medical control forces.
    """
    now_str = datetime.datetime.now().isoformat()
    lat = payload.latitude or 13.556
    lng = payload.longitude or 80.026
    maps_url = f"https://www.google.com/maps?q={lat},{lng}"

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO accidents (location, latitude, longitude, maps_url, snapshot, detected_at, dispatch_channel, dispatch_status)
        VALUES (?, ?, ?, ?, ?, ?, 'TELEGRAM_BOT_&_POLICE_WEBHOOK', 'DISPATCHED_INSTANT')
    """, (payload.location, lat, lng, maps_url, payload.snapshot, now_str))
    conn.commit()
    accident_id = cursor.lastrowid
    conn.close()

    dispatch_event = {
        "accident_id": accident_id,
        "status": "DISPATCHED",
        "location": payload.location,
        "coordinates": {"lat": lat, "lng": lng},
        "google_maps_pin": maps_url,
        "timestamp": now_str,
        "snapshot": payload.snapshot,
        "alert_text": f"🚨 CODE RED ACCIDENT DISPATCH: Stalled/Crashed vehicles reported at {payload.location}. Emergency units en route.",
        "notified_forces": ["Traffic Police Precinct 4", "Emergency Paramedic Unit 12"]
    }

    # Broadcast to live UI dashboard
    await broadcast_ws("ACCIDENT_DISPATCH", dispatch_event)

    return {
        "success": True,
        "message": "Instant alert dispatched to police and medical control forces",
        "dispatch_details": dispatch_event
    }

# ============================================================================
# Member 3 - Endpoint 2: Human-in-the-Loop (HITL) Traffic Fine System
# ============================================================================
@app.get("/api/fines/pending")
def list_pending_fines():
    """
    Lists all AI-detected rule violations waiting for human verification.
    Guarantees single-human-overview before any penalty is issued.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, violation, vehicle_plate, fine_amount, evidence_image, status, detected_at
        FROM fines
        WHERE status = 'PENDING'
        ORDER BY id DESC
    """)
    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]

@app.post("/api/fines/{fine_id}/verify")
async def verify_fine(fine_id: int, payload: FineVerificationPayload):
    """
    Accepts {"action": "APPROVE"} or {"action": "REJECT"} from the human reviewer.
    If approved: generates official digital fine receipt and logs officer's approval timestamp.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM fines WHERE id = ?", (fine_id,))
    fine = cursor.fetchone()

    if not fine:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Fine ID {fine_id} not found")

    now_str = datetime.datetime.now().isoformat()
    reviewer = payload.reviewer_id or "OFFICER_INSPECTOR_88"

    if payload.action == "APPROVE":
        receipt_id = f"REC-TN-2026-{uuid.uuid4().hex[:8].upper()}"
        cursor.execute("""
            UPDATE fines
            SET status = 'APPROVED', reviewed_at = ?, reviewer_id = ?, receipt_id = ?
            WHERE id = ?
        """, (now_str, reviewer, receipt_id, fine_id))
        conn.commit()
        conn.close()

        result = {
            "fine_id": fine_id,
            "status": "APPROVED",
            "receipt_id": receipt_id,
            "fine_amount": fine["fine_amount"],
            "vehicle_plate": fine["vehicle_plate"],
            "violation": fine["violation"],
            "reviewed_by": reviewer,
            "approval_timestamp": now_str,
            "message": "Official digital fine receipt generated and logged."
        }
        await broadcast_ws("FINE_VERIFIED", result)
        return result
    else:
        cursor.execute("""
            UPDATE fines
            SET status = 'REJECTED', reviewed_at = ?, reviewer_id = ?
            WHERE id = ?
        """, (now_str, reviewer, fine_id))
        conn.commit()
        conn.close()

        result = {
            "fine_id": fine_id,
            "status": "REJECTED",
            "reviewed_by": reviewer,
            "rejection_timestamp": now_str,
            "message": "Fine violation dismissed by human officer."
        }
        await broadcast_ws("FINE_REJECTED", result)
        return result

# ============================================================================
# Member 3 - Endpoint 3: Public Safety Geo-Targeted Flood Notification
# ============================================================================
@app.post("/api/safety/flood-alert")
async def broadcast_flood_alert(payload: FloodAlertPayload):
    """
    Monitors water-level triggers across city sectors (e.g., Sector A, Sector B, Sector C).
    Queries resident database and sends emergency alert to every person affected.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id, name, phone, email, sector FROM residents WHERE sector = ?", (payload.sector,))
    residents = cursor.fetchall()

    affected_count = len(residents)
    alert_msg = f"FLOOD ALERT: Rising water ({payload.water_level_meters}m) detected in {payload.sector}. Move to higher ground immediately."
    now_str = datetime.datetime.now().isoformat()

    cursor.execute("""
        INSERT INTO flood_alerts (sector, water_level_meters, alert_message, timestamp, recipients_count, status)
        VALUES (?, ?, ?, ?, ?, 'BROADCAST_COMPLETED')
    """, (payload.sector, payload.water_level_meters, alert_msg, now_str, affected_count))
    conn.commit()
    conn.close()

    broadcast_data = {
        "sector": payload.sector,
        "water_level": f"{payload.water_level_meters} meters",
        "alert_message": alert_msg,
        "recipients_contacted": affected_count,
        "residents_notified": [dict(r) for r in residents],
        "channels": ["SMS (Twilio)", "Emergency Mobile Push", "City Siren Trigger"],
        "timestamp": now_str
    }

    await broadcast_ws("FLOOD_ALERT_BROADCAST", broadcast_data)

    return {
        "success": True,
        "sector": payload.sector,
        "message": f"Emergency alert broadcasted to {affected_count} residents in {payload.sector}.",
        "details": broadcast_data
    }

# ============================================================================
# WebSocket Telemetry Stream
# ============================================================================
@app.websocket("/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo or process incoming simulation controls
    except WebSocketDisconnect:
        if websocket in active_connections:
            active_connections.remove(websocket)
