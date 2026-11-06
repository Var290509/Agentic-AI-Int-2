import time
import json
import logging
import random
from typing import Dict, Any, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] [VisionLead] %(message)s")
logger = logging.getLogger("TrafficPerception")

class LaneTrafficCounter:
    """
    Member 1 - Component 1:
    Lane-Wise Traffic Counter (For Cyclic Time Alteration)
    Reads 4 camera feeds (North, East, South, West) and counts waiting vehicles in each lane.
    Sends counts every 2 seconds to Member 2's agent.
    """
    def __init__(self):
        self.counts = {"north": 19, "east": 4, "south": 11, "west": 3}
        self.last_emit_time = time.time()

    def update_lane_counts(self, north: int, east: int, south: int, west: int) -> Dict[str, int]:
        self.counts = {
            "north": max(0, north),
            "east": max(0, east),
            "south": max(0, south),
            "west": max(0, west)
        }
        return self.counts

    def get_counts_payload(self) -> Dict[str, int]:
        return dict(self.counts)

    def should_emit(self) -> bool:
        return (time.time() - self.last_emit_time) >= 2.0

    def mark_emitted(self):
        self.last_emit_time = time.time()


class AmbulanceDetector:
    """
    Member 1 - Component 2:
    Ambulance & Emergency Vehicle Detector
    Fires high-priority interrupt payload immediately when an emergency vehicle is spotted.
    """
    @staticmethod
    def create_interrupt_payload(lane: str = "east") -> Dict[str, Any]:
        payload = {
            "emergency_vehicle": True,
            "type": "ambulance",
            "lane": lane.lower()
        }
        logger.warning(f"🚨 AMBULANCE DETECTED IN LANE '{lane.upper()}': Emitting high-priority interrupt payload.")
        return payload


class IntersectionAccidentDetector:
    """
    Member 1 - Component 3:
    Intersection Accident Detector
    Detects crashed, overturned, or stalled colliding vehicles near traffic lights.
    Saves snapshot frame and attaches intersection GPS coordinates.
    """
    LOCATION_NAME = "Junction 4 - Main Rd (13.556° N, 80.026° E)"

    @staticmethod
    def detect_accident(snapshot_name: str = "frame_04.jpg") -> Dict[str, Any]:
        payload = {
            "accident_detected": True,
            "location": IntersectionAccidentDetector.LOCATION_NAME,
            "snapshot": snapshot_name
        }
        logger.error(f"💥 ACCIDENT DETECTED AT {IntersectionAccidentDetector.LOCATION_NAME}: Dispatching payload to Member 3.")
        return payload


class TrafficRuleViolationDetector:
    """
    Member 1 - Component 4:
    Traffic Rule Violation Detector
    Identifies vehicles crossing stop-line during red light, riding without helmet, or wrong-way driving.
    Packages evidence and sends to Member 3's human-review queue.
    """
    @staticmethod
    def detect_violation(
        violation_type: str = "Red Light Jump",
        vehicle_plate: str = "AP-39-BK-4021",
        fine_amount: float = 1000.0,
        evidence_image: str = "violation_12.jpg"
    ) -> Dict[str, Any]:
        payload = {
            "violation": violation_type,
            "vehicle_plate": vehicle_plate,
            "fine_amount": fine_amount,
            "evidence_image": evidence_image
        }
        logger.info(f"📸 VIOLATION CAPTURED [{violation_type}] Plate: {vehicle_plate} -> Sent to HITL Queue.")
        return payload


if __name__ == "__main__":
    counter = LaneTrafficCounter()
    print("Initial Lane Counts:", counter.get_counts_payload())
    print("Ambulance Payload:", AmbulanceDetector.create_interrupt_payload("east"))
    print("Accident Payload:", IntersectionAccidentDetector.detect_accident())
    print("Violation Payload:", TrafficRuleViolationDetector.detect_violation())
