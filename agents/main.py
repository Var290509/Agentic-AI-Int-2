import asyncio
import json
import logging
from typing import Dict, Any
from .schemas import LaneTrafficCounts, EmergencyVehicleInterrupt
from .cyclic_timer_agent import CyclicTrafficSignalTimerAgent
from .ambulance_preemption_agent import AmbulancePreemptionAgent
from .natural_light_energy_agent import NaturalLightStreetLightEnergyAgent

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("AgentBrain")

class AgentBrainSystem:
    def __init__(self):
        self.cyclic_agent = CyclicTrafficSignalTimerAgent()
        self.preemption_agent = AmbulancePreemptionAgent(self.cyclic_agent)
        self.energy_agent = NaturalLightStreetLightEnergyAgent(initial_daylight=85.0)

    def on_vehicle_counts_received(self, counts_dict: Dict[str, int]):
        counts = LaneTrafficCounts(**counts_dict)
        self.cyclic_agent.update_counts(counts)
        logger.info(f"Updated lane vehicle counts: {counts.model_dump()}")

    def on_ambulance_detected(self, lane: str):
        interrupt = EmergencyVehicleInterrupt(lane=lane)
        state = self.preemption_agent.trigger_ambulance(interrupt)
        logger.warning(f"🚨 EMERGENCY PREEMPTION TRIGGERED for lane: {lane.upper()}")
        return state

    def on_ambulance_cleared(self):
        state = self.preemption_agent.clear_ambulance()
        logger.info("🚑 Ambulance cleared intersection. Resumed normal cyclic rotation.")
        return state

    def on_daylight_changed(self, daylight_percent: float):
        state = self.energy_agent.set_daylight(daylight_percent)
        logger.info(f"💡 Ambient daylight: {daylight_percent}%, Streetlight power: {state.street_light_brightness}%, Saved: {state.energy_saved_percent}%")
        return state

    def get_full_telemetry(self) -> Dict[str, Any]:
        signal_state = self.preemption_agent.tick()
        energy_state = self.energy_agent.compute_state()
        return {
            "signal": signal_state.model_dump(),
            "energy": energy_state.model_dump()
        }

if __name__ == "__main__":
    system = AgentBrainSystem()
    print("Agent Brain Initialized:")
    print("Initial State:", json.dumps(system.get_full_telemetry(), indent=2))
