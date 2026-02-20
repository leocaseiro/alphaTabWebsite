"use client";

import * as alphaTab from "@coderline/alphatab";
import type React from "react";
import styles from "./styles.module.scss";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as solid from "@fortawesome/free-solid-svg-icons";
import { createContext, useContext, useEffect, useId, useState } from "react";
import Chrome from "@uiw/react-color-chrome";
import { useDebounce } from "@uidotdev/usehooks";
import { rgbaToHexa } from "@uiw/react-color";
import { BpmSpeedControl } from "./bpm-speed-control";
import { settingsSyncEmitter } from "./settings-sync";

type SettingsContextProps = {
  api: alphaTab.AlphaTabApi;
  onSettingsUpdated(): void;
};

const SettingsContext = createContext<SettingsContextProps>(null!);

type TypeScriptEnum = { [key: number | string]: number | string };

type ValueAccessor = {
  getValue(context: SettingsContextProps): any;
  setValue(context: SettingsContextProps, value: any): void;
};
type ControlProps = ValueAccessor & { inputId: string };

type ButtonGroupButtonSchema = { label: string; value: any };

type ButtonGroupSchema = {
  type: "button-group";
  buttons: ButtonGroupButtonSchema[];
};
type NumberInputSchema = {
  type: "number-input";
  min?: number;
  max?: number;
  step?: number;
};
type BooleanToggleSchema = { type: "boolean-toggle" };
type NumberRangeSchema = {
  type: "number-range";
  min: number;
  max: number;
  step: number;
};
type EnumDropDownSchema = { type: "enum-dropdown"; enumType: TypeScriptEnum };
type BpmSpeedControlSchema = { type: "bpm-speed-control" };

type SettingSchema = {
  label: string;
  control:
    | ButtonGroupSchema
    | EnumDropDownSchema
    | NumberRangeSchema
    | NumberInputSchema
    | BooleanToggleSchema
    | BpmSpeedControlSchema;
  prepareValue?(value: any): any;
} & ValueAccessor;
type SettingsGroupSchema = { title: string; settings: SettingSchema[] };

type UpdateSettingsOptions = {
  prepareValue?: (value: any) => any;
  afterUpdate?: (context: SettingsContextProps) => any;
  callRender?: boolean;
  callUpdateSettings?: boolean;
};

function updateSettings(
  context: SettingsContextProps,
  update: (settings: alphaTab.Settings) => void,
  options?: UpdateSettingsOptions,
) {
  const api = context.api;
  update(api.settings);
  if (options?.callUpdateSettings ?? true) {
    api.updateSettings();
  }
  if (options?.callRender ?? true) {
    api.render();
  }
  context.onSettingsUpdated();
  settingsSyncEmitter.notify("practice-mode-settings");
  options?.afterUpdate?.(context);
}

const factory = {
  settingAccessors(setting: string, updateOptions?: UpdateSettingsOptions) {
    const parts = setting.split(".");
    return {
      getValue(context: SettingsContextProps) {
        let setting: any = context.api.settings;
        for (let i = 0; i < parts.length - 1; i++) {
          setting = setting[parts[i]];
        }
        return setting[parts[parts.length - 1]];
      },
      setValue(context: SettingsContextProps, value) {
        updateSettings(
          context,
          (s) => {
            for (let i = 0; i < parts.length - 1; i++) {
              s = s[parts[i]];
            }
            if (updateOptions?.prepareValue) {
              value = updateOptions?.prepareValue(value);
            }
            s[parts[parts.length - 1]] = value;
          },
          updateOptions,
        );
      },
    };
  },
  apiAccessors(setting: string) {
    return {
      getValue(context: SettingsContextProps) {
        return context.api[setting];
      },
      setValue(context: SettingsContextProps, value) {
        context.api[setting] = value;
        context.onSettingsUpdated();
        settingsSyncEmitter.notify("practice-mode-settings");
      },
    };
  },

  numberRange(
    label: string,
    setting: string,
    min: number,
    max: number,
    step: number,
    updateOptions?: UpdateSettingsOptions,
  ): SettingSchema {
    return {
      label: label,
      ...factory.settingAccessors(setting, updateOptions),
      control: { type: "number-range", min, max, step },
    };
  },

  toggle(
    label: string,
    setting: string,
    updateOptions?: UpdateSettingsOptions,
  ): SettingSchema {
    return {
      label: label,
      ...factory.settingAccessors(setting, updateOptions),
      control: { type: "boolean-toggle" },
    };
  },

  enumDropDown(
    label: string,
    setting: string,
    enumType: TypeScriptEnum,
    updateOptions?: UpdateSettingsOptions,
  ): SettingSchema {
    return {
      label: label,
      ...factory.settingAccessors(setting, updateOptions),
      control: { type: "enum-dropdown", enumType },
    };
  },
};

// Build Practice Mode Settings Groups
function buildPracticeSettingsGroups(): SettingsGroupSchema[] {
  const noRerender: UpdateSettingsOptions = {
    callRender: false,
    callUpdateSettings: true,
  };

  return [
    {
      title: "Display Control",
      settings: [
        factory.numberRange("Scale", "display.scale", 0.25, 2, 0.25),
        factory.numberRange("Stretch", "display.stretchForce", 0.25, 2, 0.25),
        factory.enumDropDown(
          "Layout",
          "display.layoutMode",
          alphaTab.LayoutMode,
        ),
      ],
    },
    {
      title: "Player Control",
      settings: [
        {
          label: "Volume",
          ...factory.apiAccessors("masterVolume"),
          control: { type: "number-range", min: 0, max: 1, step: 0.1 },
        },
        {
          label: "Metronome Volume",
          ...factory.apiAccessors("metronomeVolume"),
          control: { type: "number-range", min: 0, max: 1, step: 0.1 },
        },
        {
          label: "Count-In Volume",
          ...factory.apiAccessors("countInVolume"),
          control: { type: "number-range", min: 0, max: 1, step: 0.1 },
        },
        {
          label: "BPM / Playback Speed",
          ...factory.apiAccessors("playbackSpeed"),
          control: { type: "bpm-speed-control" },
        },
        {
          label: "Looping",
          ...factory.apiAccessors("isLooping"),
          control: { type: "boolean-toggle" },
        },
      ],
    },
    {
      title: "Visual Display",
      settings: [
        factory.toggle("Show Cursors", "player.enableCursor", noRerender),
        factory.toggle(
          "Animated Beat Cursor",
          "player.enableAnimatedBeatCursor",
          noRerender,
        ),
        factory.toggle(
          "Highlight Notes",
          "player.enableElementHighlighting",
          noRerender,
        ),
        factory.toggle(
          "Enable User Interaction",
          "player.enableUserInteraction",
          noRerender,
        ),
        factory.enumDropDown(
          "Scroll Mode",
          "player.scrollMode",
          alphaTab.ScrollMode,
          noRerender,
        ),
      ],
    },
  ];
}

const EnumDropDown: React.FC<EnumDropDownSchema & ControlProps> = ({
  enumType,
  inputId,
  getValue,
  setValue,
}) => {
  const settings = useContext(SettingsContext)!;
  const [displayValue, setDisplayValue] = useState(() => getValue(settings));

  useEffect(() => {
    const unsubscribe = settingsSyncEmitter.subscribe((source) => {
      if (source !== "practice-mode-settings") {
        const currentValue = getValue(settings);
        setDisplayValue((prev) => {
          if (prev !== currentValue) {
            return currentValue;
          }
          return prev;
        });
      }
    });

    return unsubscribe;
  }, [getValue, settings]);

  const enumValues: { value: number; label: string }[] = [];
  for (const value of Object.values(enumType)) {
    if (typeof value === "string") {
      const key = enumType[value] as number;
      enumValues.push({ value: key, label: value });
    }
  }

  return (
    <div className={styles.select}>
      <select
        id={inputId}
        value={displayValue}
        onChange={(e) => {
          const newValue = Number.parseInt(e.target.value);
          setDisplayValue(newValue);
          setValue(settings, newValue);
        }}
      >
        {enumValues.map((v) => (
          <option key={v.value} value={v.value}>
            {v.label}
          </option>
        ))}
      </select>
    </div>
  );
};

const NumberRange: React.FC<NumberRangeSchema & ControlProps> = ({
  min,
  max,
  step,
  inputId,
  getValue,
  setValue,
}) => {
  const settings = useContext(SettingsContext)!;
  const [displayValue, setDisplayValue] = useState(() => getValue(settings));

  useEffect(() => {
    const unsubscribe = settingsSyncEmitter.subscribe((source) => {
      if (source !== "practice-mode-settings") {
        const currentValue = getValue(settings);
        setDisplayValue((prev) => {
          if (prev !== currentValue) {
            return currentValue;
          }
          return prev;
        });
      }
    });

    return unsubscribe;
  }, [getValue, settings]);

  return (
    <div
      className={styles.slider}
      data-tooltip-id="tooltip-playground"
      data-tooltip-place="left"
      data-tooltip-content={String(displayValue)}
    >
      <input
        type="range"
        id={inputId}
        min={min}
        max={max}
        step={step}
        value={displayValue}
        onChange={(e) => {
          const newValue = (e.target as HTMLInputElement).valueAsNumber;
          setDisplayValue(newValue);
          setValue(settings, newValue);
        }}
        onInput={(e) => {
          const newValue = (e.target as HTMLInputElement).valueAsNumber;
          setDisplayValue(newValue);
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      />
    </div>
  );
};

const BooleanToggle: React.FC<BooleanToggleSchema & ControlProps> = ({
  inputId,
  getValue,
  setValue,
}) => {
  const settings = useContext(SettingsContext)!;
  const [displayValue, setDisplayValue] = useState(() => getValue(settings));

  useEffect(() => {
    const unsubscribe = settingsSyncEmitter.subscribe((source) => {
      if (source !== "practice-mode-settings") {
        const currentValue = getValue(settings);
        setDisplayValue((prev) => {
          if (prev !== currentValue) {
            return currentValue;
          }
          return prev;
        });
      }
    });

    return unsubscribe;
  }, [getValue, settings]);

  return (
    <>
      <label className={styles.toggle}>
        <input
          id={inputId}
          type="checkbox"
          checked={displayValue}
          onChange={(e) => {
            const newValue = (e.target as HTMLInputElement).checked;
            setDisplayValue(newValue);
            setValue(settings, newValue);
          }}
        />
        <span />
      </label>
    </>
  );
};

const BpmSpeedControlWrapper: React.FC<
  BpmSpeedControlSchema & ControlProps
> = ({ inputId, getValue, setValue }) => {
  const settings = useContext(SettingsContext)!;

  return (
    <BpmSpeedControl
      api={settings.api}
      onSpeedChange={(speed) => setValue(settings, speed)}
      inputId={inputId}
      showMarker={true}
    />
  );
};

const Setting: React.FC<SettingSchema> = ({
  label,
  control,
  getValue,
  setValue,
}) => {
  const id = useId();
  const renderControl = () => {
    switch (control.type) {
      case "enum-dropdown":
        return (
          <EnumDropDown
            inputId={id}
            {...control}
            getValue={getValue}
            setValue={setValue}
          />
        );
      case "number-range":
        return (
          <NumberRange
            inputId={id}
            {...control}
            getValue={getValue}
            setValue={setValue}
          />
        );
      case "boolean-toggle":
        return (
          <BooleanToggle
            inputId={id}
            {...control}
            getValue={getValue}
            setValue={setValue}
          />
        );
      case "bpm-speed-control":
        return (
          <BpmSpeedControlWrapper
            inputId={id}
            {...control}
            getValue={getValue}
            setValue={setValue}
          />
        );
    }
  };

  return (
    <div className={`${styles["settings-item"]}`}>
      <label className={`${styles["settings-item-label"]}`} htmlFor={id}>
        {label}
      </label>
      <div className={`${styles["settings-item-control"]}`}>
        {renderControl()}
      </div>
    </div>
  );
};

const SettingsGroup: React.FC<SettingsGroupSchema> = ({ title, settings }) => {
  return (
    <div className={styles["at-settings-group"]} key={title}>
      <h4>{title}</h4>
      {settings.map((s) => (
        <Setting key={s.label} {...s} />
      ))}
    </div>
  );
};

export interface PracticeModeSettingsProps {
  api: alphaTab.AlphaTabApi;
  isOpen: boolean;
  onClose: () => void;
}

export const PracticeModeSettings: React.FC<PracticeModeSettingsProps> = ({
  api,
  isOpen,
  onClose,
}) => {
  const [settingsVersion, setSettingsVersion] = useState(0);
  const settingsGroups = buildPracticeSettingsGroups();

  return (
    <SettingsContext.Provider
      value={{
        api,
        onSettingsUpdated() {
          setSettingsVersion((v) => v + 1);
        },
      }}
    >
      <div
        className={`${styles["at-settings"]} ${styles["at-practice-settings"]} shadow--tl ${isOpen ? styles.open : ""}`}
        data-version={settingsVersion}
      >
        <button
          type="button"
          onClick={() => onClose()}
          className={`button button--sm button--primary button--outline ${styles["at-settings-close"]}`}
        >
          <FontAwesomeIcon icon={solid.faClose} />
        </button>

        <div className={styles["at-settings-header"]}>
          <h3>
            <FontAwesomeIcon icon={solid.faHeadphones} /> Practice Mode
          </h3>
          <p>Quick access to essential practice settings</p>
        </div>

        {settingsGroups.map((g) => (
          <SettingsGroup key={g.title} {...g} />
        ))}
      </div>
    </SettingsContext.Provider>
  );
};
