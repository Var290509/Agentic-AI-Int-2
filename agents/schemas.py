from typing import Literal, Optional, Dict
from pydantic import BaseModel, Field

LaneType = Literal["north", "east", "south", "west"]

class LaneTrafficCounts(BaseModel):
    """Lane counts payload sent every 2s by Member 1"""
    north: int = Field(default=0, ge=0)
    east: int = Field(default=0, ge=0)
    south: int = Field(default=0, ge=0)
    west: int = Field(default=0, ge=0)

class EmergencyVehicleInterrupt(BaseModel):
    """High priority ambulance interrupt payload from Member 1"""
    emergency_vehicle: bool = True
    type: str = "ambulance"
    lane: LaneType

class PausedCycleState(BaseModel):
    """Saved cycle state during ambulance preemption"""
    paused_lane: LaneType
    remaining_time: float

class TrafficSignalState(BaseModel):
    """Current live traffic signal status across all 4 lanes"""
    current_lane: LaneType
    state: Literal["GREEN", "YELLOW", "RED"]
    elapsed_time: float
    total_duration: float
    remaining_time: float
    is_preempted: bool = False
    preempted_by: Optional[str] = None
    lane_signals: Dict[LaneType, Literal["RED", "YELLOW", "GREEN"]]
    counts: LaneTrafficCounts

class StreetLightEnergyState(BaseModel):
    """Ambient daylight lux calculation and street light brightness"""
    natural_light_percent: float = Field(ge=0.0, le=100.0) # 0% Night to 100% Sunny
    street_light_brightness: float = Field(ge=0.0, le=100.0)
    power_state: Literal["OFF", "DIM", "ON"]
    energy_saved_percent: float = Field(ge=0.0, le=100.0)
