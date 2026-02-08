import { useEffect, useRef, useState, useCallback } from "react";

/**
 * MIDI input event data
 */
export interface MidiInputEvent {
  type: "noteOn" | "noteOff";
  midiNote: number;
  velocity: number;
  timestamp: number;
  portName: string;
}

/**
 * MIDI port info
 */
export interface MidiPortInfo {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
  connection: string;
}

/**
 * Hook return type
 */
export interface UseMidiInputReturn {
  isSupported: boolean;
  isConnected: boolean;
  inputs: MidiPortInfo[];
  error: string | null;
}

/**
 * React hook to automatically detect and listen to MIDI inputs
 * PERFORMANCE OPTIMIZED for rhythm games with minimal latency
 *
 * @param onMidiMessage - Stable callback fired when a MIDI message is received
 * @param enabled - Enable/disable MIDI listening (default: true)
 */
export function useMidiInput(
  onMidiMessage: ((event: MidiInputEvent) => void) | undefined,
  enabled: boolean = true,
): UseMidiInputReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [inputs, setInputs] = useState<MidiPortInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const inputsRef = useRef<MIDIInput[]>([]);
  
  // Store callback in ref to avoid recreating message handlers
  const callbackRef = useRef(onMidiMessage);
  
  // Update callback ref without triggering re-setup
  useEffect(() => {
    callbackRef.current = onMidiMessage;
  }, [onMidiMessage]);

  // Pre-create message handler to avoid allocations during MIDI events
  const handleMidiMessage = useCallback((event: MIDIMessageEvent, portName: string) => {
    const data = event.data;
    const status = data[0];
    const note = data[1];
    const velocity = data[2];

    // Fast path: only handle note on/off messages
    const command = status & 0xf0;

    // MIDI message types
    // 0x90 = Note On (144)
    // 0x80 = Note Off (128)
    let type: "noteOn" | "noteOff" | null = null;

    if (command === 0x90 && velocity > 0) {
      type = "noteOn";
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      type = "noteOff";
    }

    if (type && callbackRef.current) {
      // Only allocate event object if we have a callback
      const midiEvent: MidiInputEvent = {
        type,
        midiNote: note,
        velocity,
        timestamp: event.timeStamp,
        portName,
      };

      // Call user callback immediately - no state updates for low latency
      callbackRef.current(midiEvent);
    }
  }, []); // No dependencies - stable function

  useEffect(() => {
    // Check if Web MIDI API is supported
    if (!navigator.requestMIDIAccess) {
      setIsSupported(false);
      setError("Web MIDI API is not available in your browser.");
      if (process.env.NODE_ENV === "development") {
        console.warn("Web MIDI API not supported");
      }
      return;
    }

    setIsSupported(true);

    if (!enabled) {
      return;
    }

    // Request MIDI access
    navigator
      .requestMIDIAccess({ sysex: false })
      .then((access) => {
        midiAccessRef.current = access;
        setupMidiInputs(access);

        // Listen for device connection changes
        access.onstatechange = (event) => {
          const port = event.port as MIDIPort;
          if (process.env.NODE_ENV === "development") {
            console.log("MIDI device state change:", {
              name: port.name,
              state: port.state,
              connection: port.connection,
              type: port.type,
            });
          }

          // Refresh inputs when devices connect/disconnect
          setupMidiInputs(access);
        };
      })
      .catch((err) => {
        console.error("Failed to get MIDI access:", err);
        setError("Failed to access MIDI devices. Please check permissions.");
      });

    return () => {
      // Cleanup: remove all listeners
      inputsRef.current.forEach((input) => {
        input.onmidimessage = null;
        input.onstatechange = null;
      });
      inputsRef.current = [];

      if (midiAccessRef.current) {
        midiAccessRef.current.onstatechange = null;
      }
    };
  }, [enabled, handleMidiMessage]);

  const setupMidiInputs = useCallback((access: MIDIAccess) => {
    const inputList: MIDIInput[] = [];
    const inputInfo: MidiPortInfo[] = [];

    // Get all MIDI inputs
    const iterator = access.inputs.values();
    for (let input = iterator.next(); !input.done; input = iterator.next()) {
      const midiInput = input.value;
      inputList.push(midiInput);

      inputInfo.push({
        id: midiInput.id,
        name: midiInput.name ?? "Unknown",
        manufacturer: midiInput.manufacturer ?? "Unknown",
        state: midiInput.state,
        connection: midiInput.connection,
      });

      // Store portName to avoid accessing property during event
      const portName = midiInput.name ?? "Unknown";
      
      // Attach message handler - use bound function for performance
      midiInput.onmidimessage = (event: MIDIMessageEvent) => {
        handleMidiMessage(event, portName);
      };

      // Attach state change handler
      midiInput.onstatechange = (event) => {
        const port = event.port as MIDIInput;
        if (process.env.NODE_ENV === "development") {
          console.log("MIDI input state change:", {
            name: port.name,
            state: port.state,
            connection: port.connection,
          });
        }
      };

      if (process.env.NODE_ENV === "development") {
        console.log("MIDI input connected:", {
          name: midiInput.name,
          manufacturer: midiInput.manufacturer,
          id: midiInput.id,
        });
      }
    }

    inputsRef.current = inputList;
    setInputs(inputInfo);
    setIsConnected(inputList.length > 0);

    if (inputList.length === 0 && process.env.NODE_ENV === "development") {
      console.log("No MIDI inputs detected");
    }
  }, [handleMidiMessage]);

  return {
    isSupported,
    isConnected,
    inputs,
    error,
  };
}
