from typing import List, Dict, Optional
import time
from .schemas import LaneType, LaneTrafficCounts, TrafficSignalState

CYCLE_ORDER: List[LaneType] = ["north", "east", "south", "west"]
YELLOW_DURATION = 3.0 # Standard safety clearance interval

class CyclicTrafficSignalTimerAgent:
    """
    Member 2 - Component 1:
    State-machine agent rotating green lights strictly in cyclic order (North -> East -> South -> West -> North).
    Alters green duration dynamically per lane based on vehicle count:
    Green Time = min(60s, max(15s, 10s + 2s * Vehicle Count))
    Never skips a lane during normal operation.
    """
    def __init__(self):
        self.cycle_index = 0
        self.counts = LaneTrafficCounts(north=19, east=4, south=11, west=3)
        self.phase: str = "GREEN" # "GREEN" or "YELLOW"
        self.phase_start_time = time.time()
        self.current_allocated_green = self.calculate_green_time("north", self.counts.north)

    def calculate_green_time(self, lane: LaneType, vehicle_count: int) -> float:
        """Exact formula: min(60s, max(15s, 10s + 2s * Vehicle Count))"""
        raw = 10.0 + (2.0 * float(vehicle_count))
        clamped = min(60.0, max(15.0, raw))
        return clamped

    def update_counts(self, counts: LaneTrafficCounts):
        self.counts = counts

    def get_current_lane(self) -> LaneType:
        return CYCLE_ORDER[self.cycle_index]

    def advance_cycle(self):
        self.cycle_index = (self.cycle_index + 1) % len(CYCLE_ORDER)
        current_lane = self.get_current_lane()
        vehicle_count = getattr(self.counts, current_lane)
        self.current_allocated_green = self.calculate_green_time(current_lane, vehicle_count)
        self.phase = "GREEN"
        self.phase_start_time = time.time()

    def tick(self) -> TrafficSignalState:
        now = time.time()
        elapsed = now - self.phase_start_time
        current_lane = self.get_current_lane()

        if self.phase == "GREEN":
            if elapsed >= self.current_allocated_green:
                self.phase = "YELLOW"
                self.phase_start_time = now
                elapsed = 0.0
                remaining = YELLOW_DURATION
            else:
                remaining = max(0.0, self.current_allocated_green - elapsed)
        else: # YELLOW
            if elapsed >= YELLOW_DURATION:
                self.advance_cycle()
                current_lane = self.get_current_lane()
                elapsed = 0.0
                remaining = self.current_allocated_green
            else:
                remaining = max(0.0, YELLOW_DURATION - elapsed)

        # Build signal light dict for all 4 lanes
        lane_signals: Dict[LaneType, str] = {}
        for lane in CYCLE_ORDER:
            if lane == current_lane:
                lane_signals[lane] = self.phase
            else:
                lane_signals[lane] = "RED"

        total_duration = self.current_allocated_green if self.phase == "GREEN" else YELLOW_DURATION

        return TrafficSignalState(
            current_lane=current_lane,
            state=self.phase,
            elapsed_time=round(elapsed, 2),
            total_duration=round(total_duration, 2),
            remaining_time=round(remaining, 2),
            is_preempted=False,
            preempted_by=None,
            lane_signals=lane_signals,
            counts=self.counts
        )
