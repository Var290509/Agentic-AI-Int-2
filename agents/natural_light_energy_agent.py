from .schemas import StreetLightEnergyState

class NaturalLightStreetLightEnergyAgent:
    """
    Member 2 - Component 3:
    Natural-Light Street Light Energy Management Agent:
    Reads natural light intensity (0% to 100%) and dynamically adjusts street light brightness.
    
    Exact Logic:
    - Bright Natural Light (> 70% daylight): Street lights set to 0% power (OFF).
    - Cloudy / Storm / Twilight (30% - 70% natural light): Street lights scale inversely
      between 30% and 70% brightness. (brightness = 100 - daylight)
    - Darkness / Night (< 30% natural light): Street lights set to 80% - 100% brightness.
      (linear ramp from 100% at 0 daylight down to 80% at 30 daylight)
    - Continuously calculate and output Energy Saved (%) for the dashboard.
    """
    def __init__(self, initial_daylight: float = 85.0):
        self.daylight: float = initial_daylight

    def set_daylight(self, daylight_percent: float) -> StreetLightEnergyState:
        self.daylight = max(0.0, min(100.0, float(daylight_percent)))
        return self.compute_state()

    def compute_state(self) -> StreetLightEnergyState:
        d = self.daylight

        if d > 70.0:
            # Bright natural light: OFF
            brightness = 0.0
            power_state = "OFF"
        elif 30.0 <= d <= 70.0:
            # Cloudy / Storm / Twilight: scale inversely between 30% and 70%
            brightness = 100.0 - d
            power_state = "DIM"
        else: # d < 30.0
            # Darkness / Night: 80% to 100% brightness
            # At d=0 -> 100%, at d=30 -> 80%
            brightness = 100.0 - (d / 30.0) * 20.0
            power_state = "ON"

        # Energy saved is the inverse of consumed brightness
        energy_saved = max(0.0, min(100.0, 100.0 - brightness))

        return StreetLightEnergyState(
            natural_light_percent=round(d, 1),
            street_light_brightness=round(brightness, 1),
            power_state=power_state,
            energy_saved_percent=round(energy_saved, 1)
        )
