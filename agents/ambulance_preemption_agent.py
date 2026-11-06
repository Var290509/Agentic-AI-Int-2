from typing import Optional, Dict
import time
from .schemas import LaneType, EmergencyVehicleInterrupt, PausedCycleState, TrafficSignalState
from .cyclic_timer_agent import CyclicTrafficSignalTimerAgent, CYCLE_ORDER

class AmbulancePreemptionAgent:
    """
    Member 2 - Component 2:
    Autonomous interrupt controller that listens for Member 1's ambulance detection.
    
    Step 1 (Interrupt): The moment an ambulance is detected in any lane,
    save the current cycle state in memory (paused_lane, remaining_time).
    
    Step 2 (Preempt): Immediately turn all other lanes Red and open
    the ambulance's lane to Green irrespective of normal cyclic order.
    
    Step 3 (Resume Normal Cycle): As soon as camera confirms ambulance has
    crossed the junction, restore paused_lane and continue cyclic rotation.
    """
    def __init__(self, cyclic_agent: CyclicTrafficSignalTimerAgent):
        self.cyclic_agent = cyclic_agent
        self.is_preempted: bool = False
        self.ambulance_lane: Optional[LaneType] = None
        self.paused_state: Optional[PausedCycleState] = None
        self.preemption_start_time: float = 0.0
        self.preemption_max_duration: float = 25.0 # Safety timeout if vehicle stalls

    def trigger_ambulance(self, interrupt: EmergencyVehicleInterrupt) -> TrafficSignalState:
        """Step 1 & Step 2: Save state and force ambulance lane Green"""
        if not self.is_preempted:
            current_lane = self.cyclic_agent.get_current_lane()
            now = time.time()
            elapsed = now - self.cyclic_agent.phase_start_time
            remaining = max(1.0, self.cyclic_agent.current_allocated_green - elapsed)

            # Step 1: Save state in memory
            self.paused_state = PausedCycleState(
                paused_lane=current_lane,
                remaining_time=round(remaining, 2)
            )
            self.is_preempted = True
            self.ambulance_lane = interrupt.lane
            self.preemption_start_time = now

        return self.get_preemption_state()

    def clear_ambulance(self) -> TrafficSignalState:
        """Step 3: Resume normal cycle, restoring paused lane and remaining time"""
        if self.is_preempted and self.paused_state:
            # Restore paused lane in cyclic agent
            lane_to_restore = self.paused_state.paused_lane
            remaining = self.paused_state.remaining_time

            # Update cyclic agent cycle index to match paused lane
            if lane_to_restore in CYCLE_ORDER:
                self.cyclic_agent.cycle_index = CYCLE_ORDER.index(lane_to_restore)

            self.cyclic_agent.phase = "GREEN"
            self.cyclic_agent.current_allocated_green = remaining
            self.cyclic_agent.phase_start_time = time.time()

            # Clear preemption flags
            self.is_preempted = False
            self.ambulance_lane = None
            self.paused_state = None

        return self.cyclic_agent.tick()

    def get_preemption_state(self) -> TrafficSignalState:
        now = time.time()
        elapsed = now - self.preemption_start_time
        remaining = max(0.0, self.preemption_max_duration - elapsed)

        # Force ambulance lane GREEN, all other lanes RED
        lane_signals: Dict[LaneType, str] = {}
        for lane in CYCLE_ORDER:
            if lane == self.ambulance_lane:
                lane_signals[lane] = "GREEN"
            else:
                lane_signals[lane] = "RED"

        return TrafficSignalState(
            current_lane=self.ambulance_lane or "east",
            state="GREEN",
            elapsed_time=round(elapsed, 2),
            total_duration=self.preemption_max_duration,
            remaining_time=round(remaining, 2),
            is_preempted=True,
            preempted_by="ambulance",
            lane_signals=lane_signals,
            counts=self.cyclic_agent.counts
        )

    def tick(self) -> TrafficSignalState:
        if self.is_preempted:
            # Auto-clear if safety timeout reached
            if time.time() - self.preemption_start_time >= self.preemption_max_duration:
                return self.clear_ambulance()
            return self.get_preemption_state()
        else:
            return self.cyclic_agent.tick()
