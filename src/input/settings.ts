export interface InputSettings {
  /** Radians per mouse pixel. */
  mouseSens: number;
  /** Multiplier on gamepad look rates. */
  padSens: number;
  invertY: boolean;
  /** Aim assist for gamepads. */
  aimAssist: boolean;
}

export const DEFAULT_INPUT_SETTINGS: InputSettings = { mouseSens: 0.0022, padSens: 1, invertY: false, aimAssist: true };
