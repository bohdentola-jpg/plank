// The people in COLD BOOT are Microsoft Rocketbox avatars (MIT, see
// assets/people/LICENSE-Rocketbox.md), converted by tools/build_people.mjs into
// assets/people/<id>.glb, animated with Rocketbox motion capture
// (assets/people/anim_m.glb, anim_f.glb). This file is read by both the build
// tool and the game.
//
// AVATARS: id → { src: Rocketbox folder under Assets/Avatars, sex: 'm'|'f',
//   tier: 'hero' (close-ups: 1024 maps) | 'named' | 'folk' (smaller maps),
//   look: baked texture looks { hair: {grey, white}, age, cloth: {hue,sat,val,lift,grey} },
//   drop: material parts left out (helmet, pistol…), keep: optional parts kept but hideable,
//   label: what the character creator shows }

export const AVATARS = {
  // ---------------------------------------------------------------- the team (Bely Mys)
  Male_Adult_05: { src: 'Adults/Male_Adult_05', sex: 'm', tier: 'hero', look: { hair: { grey: 0.45 } } },
  Female_Adult_14: { src: 'Adults/Female_Adult_14', sex: 'f', tier: 'hero' },
  Male_Adult_20: { src: 'Adults/Male_Adult_20', sex: 'm', tier: 'hero' },
  Delivery_Male_01: { src: 'Professions/Delivery_Male_01', sex: 'm', tier: 'hero' },
  Business_Female_02: { src: 'Professions/Business_Female_02', sex: 'f', tier: 'hero', look: { hair: { white: 0.75 }, age: 0.6 } },
  Business_Male_04: { src: 'Professions/Business_Male_04', sex: 'm', tier: 'hero' },
  // ---------------------------------------------------------------- Port Zarya
  Pilot_Male_02: { src: 'Professions/Pilot_Male_02', sex: 'm', tier: 'named' },
  Business_Male_05: { src: 'Professions/Business_Male_05', sex: 'm', tier: 'hero', look: { cloth: { grey: 0.92, val: 1.25, lift: 0.16 } } },
  Construction_Male_02: { src: 'Professions/Construction_Male_02', sex: 'm', tier: 'named', drop: ['helmet'] },
  Male_Adult_13: { src: 'Adults/Male_Adult_13', sex: 'm', tier: 'named', look: { hair: { grey: 0.3 } } },
  Male_Adult_14: { src: 'Adults/Male_Adult_14', sex: 'm', tier: 'named', look: { hair: { white: 0.9 }, age: 0.5 } },
  Female_Adult_02: { src: 'Adults/Female_Adult_02', sex: 'f', tier: 'named', look: { hair: { grey: 0.2 }, age: 0.25 } },
  Male_Adult_12: { src: 'Adults/Male_Adult_12', sex: 'm', tier: 'named' },
  Female_Adult_03: { src: 'Adults/Female_Adult_03', sex: 'f', tier: 'named', look: { hair: { grey: 0.65 }, age: 0.45 } },
  Business_Male_03: { src: 'Professions/Business_Male_03', sex: 'm', tier: 'named' },
  Security_Female_01: { src: 'Professions/Security_Female_01', sex: 'f', tier: 'named', look: { age: 0.25 }, keep: ['hat'] },
  Business_Male_02: { src: 'Professions/Business_Male_02', sex: 'm', tier: 'named' },
  Business_Male_07: { src: 'Professions/Business_Male_07', sex: 'm', tier: 'named', look: { age: 0.3 } },
  Male_Adult_03: { src: 'Adults/Male_Adult_03', sex: 'm', tier: 'named', look: { hair: { white: 0.5 }, cloth: { grey: 0.85, val: 0.55 } } },
  Male_Adult_08: { src: 'Adults/Male_Adult_08', sex: 'm', tier: 'named' },
  Male_Adult_15: { src: 'Adults/Male_Adult_15', sex: 'm', tier: 'named', look: { cloth: { grey: 1, val: 0.16 } } },
  Female_Adult_12: { src: 'Adults/Female_Adult_12', sex: 'f', tier: 'named' },
  Female_Adult_05: { src: 'Adults/Female_Adult_05', sex: 'f', tier: 'named', look: { cloth: { hue: 160, sat: 0.7, val: 0.5 } } },
  Male_Adult_10: { src: 'Adults/Male_Adult_10', sex: 'm', tier: 'named' },
  Medical_Female_02: { src: 'Professions/Medical_Female_02', sex: 'f', tier: 'named', look: { hair: { grey: 0.6 }, age: 0.35 } },
  Business_Female_01: { src: 'Professions/Business_Female_01', sex: 'f', tier: 'named', look: { hair: { grey: 0.7 }, age: 0.3 } },
  Military_Male_05: { src: 'Professions/Military_Male_05', sex: 'm', tier: 'named' },
  Police_Male_03: { src: 'Professions/Police_Male_03', sex: 'm', tier: 'named', drop: ['pistol'] },
  // ---------------------------------------------------------------- yours (the character creator) and the townsfolk
  Male_Adult_02: { src: 'Adults/Male_Adult_02', sex: 'm', tier: 'hero', label: 'Sweater' },
  Male_Adult_04: { src: 'Adults/Male_Adult_04', sex: 'm', tier: 'hero', label: 'Leather jacket' },
  Male_Adult_07: { src: 'Adults/Male_Adult_07', sex: 'm', tier: 'hero', label: 'Work jacket' },
  Male_Adult_09: { src: 'Adults/Male_Adult_09', sex: 'm', tier: 'hero', label: 'Long hair' },
  Male_Adult_17: { src: 'Adults/Male_Adult_17', sex: 'm', tier: 'hero', label: 'Beanie' },
  Male_Adult_18: { src: 'Adults/Male_Adult_18', sex: 'm', tier: 'hero', label: 'Hoodie' },
  Female_Adult_01: { src: 'Adults/Female_Adult_01', sex: 'f', tier: 'hero', label: 'Ponytail' },
  Female_Adult_04: { src: 'Adults/Female_Adult_04', sex: 'f', tier: 'hero', label: 'Leather jacket' },
  Female_Adult_07: { src: 'Adults/Female_Adult_07', sex: 'f', tier: 'hero', label: 'Jacket & boots' },
  Female_Adult_11: { src: 'Adults/Female_Adult_11', sex: 'f', tier: 'hero', label: 'Curls' },
  Female_Adult_15: { src: 'Adults/Female_Adult_15', sex: 'f', tier: 'hero', label: 'Long hair' },
  Female_Adult_09: { src: 'Adults/Female_Adult_09', sex: 'f', tier: 'hero', label: 'Cardigan' },
  // townsfolk only
  Medical_Female_03: { src: 'Professions/Medical_Female_03', sex: 'f', tier: 'folk' },
  Medical_Male_02: { src: 'Professions/Medical_Male_02', sex: 'm', tier: 'folk' },
  Wood_Male_01: { src: 'Professions/Wood_Male_01', sex: 'm', tier: 'folk' },
};

/** The character creator's line-up (in order). */
export const PLAYER_AVATARS = ['Male_Adult_07', 'Female_Adult_07', 'Male_Adult_04', 'Female_Adult_04', 'Male_Adult_17', 'Female_Adult_11',
  'Male_Adult_02', 'Female_Adult_15', 'Male_Adult_09', 'Female_Adult_01', 'Male_Adult_18', 'Female_Adult_09'];

/** Townsfolk wander Port Zarya: the player line-up (minus whoever you are) plus a few more. */
export const FOLK_AVATARS = ['Male_Adult_04', 'Female_Adult_04', 'Male_Adult_17', 'Female_Adult_07', 'Medical_Female_03', 'Male_Adult_18',
  'Wood_Male_01', 'Female_Adult_09', 'Medical_Male_02', 'Male_Adult_07', 'Female_Adult_11', 'Male_Adult_02', 'Female_Adult_15', 'Male_Adult_09'];

// ---------------------------------------------------------------- motion capture
// name → [male source, female source, opts] (under Assets/Animations/all_animations_max_motextr_*;
// 'xy/' and 'xyz/' clips carry root motion, which the build removes: the game moves people).
// opts: loop (cycle; long loops are cut where the pose returns closest to the start), loco (locomotion:
// in place, speed + left heel strike measured), max (seconds kept), from (start s), fps (default 30 gaits, 20 loops, 24 one-shots)
export const CLIPS = {
  // standing
  idle: ['static/m_idle_breathe_01', 'static/f_idle_breathe_01', { loop: 1 }],
  idle2: ['static/m_idle_neutral_01', 'static/f_idle_neutral_01', { loop: 1 }],
  idle3: ['static/m_idle_neutral_02', 'static/f_idle_neutral_02', { loop: 1 }],
  lookAround: ['static/m_idle_look_around_01', 'static/f_idle_look_around_01', { loop: 1 }],
  waiting: ['static/m_idle_waiting_01', 'static/f_idle_waiting_01', { loop: 1 }],
  scratchHead: ['static/m_idle_scratch_head_01', 'static/f_idle_scratch_head_01', {}],
  touchFace: ['static/m_idle_touch_face_01', 'static/f_idle_touch_face_01', {}],
  armsCrossed: ['static/m_idle_angry_01', 'static/f_gestic_listen_self-assured_01', { loop: 1 }],
  // locomotion (in place)
  walk: ['xy/m_walk_neutral_01', 'xy/f_walk_neutral_01', { loop: 1, loco: 1 }],
  walkFast: ['xy/m_walk_fast_01', 'xy/f_walk_fast_01', { loop: 1, loco: 1 }],
  jog: ['xy/m_run_slow_01', 'xy/f_run_slow_01', { loop: 1, loco: 1 }],
  run: ['xy/m_run_neutral_01', 'xy/f_run_neutral_01', { loop: 1, loco: 1 }],
  sprint: ['xy/m_run_fast_01', 'xy/f_run_fast_01', { loop: 1, loco: 1 }],
  walkSlow: ['xy/m_walk_slow_01', 'xy/f_walk_slow_01', { loop: 1, loco: 1 }],
  crouch: ['static/m_crouch_idle', 'static/f_crouch_idle', { loop: 1 }],
  // talking and listening, standing
  talk1: ['static/m_gestic_talk_neutral_01', 'static/f_gestic_talk_neutral_01', { loop: 1, max: 16 }],
  talk2: ['static/m_gestic_talk_neutral_02', 'static/f_gestic_talk_neutral_02', { loop: 1, max: 16 }],
  talk3: ['static/m_gestic_talk_relaxed_01', 'static/f_gestic_talk_relaxed_01', { loop: 1, max: 16 }],
  talkExcited: ['static/m_gestic_talk_excited_01', 'static/f_gestic_talk_excited_01', { loop: 1 }],
  talkSad: ['static/m_gestic_talk_sad_01', 'static/f_gestic_talk_sad_01', { loop: 1 }],
  talkNervous: ['static/m_gestic_talk_nervous_01', 'static/f_gestic_talk_nervous_01', { loop: 1 }],
  talkAngry: ['xyz/m_gestic_talk_angry_01', 'static/f_gestic_talk_angry_01', { loop: 1 }],
  listen1: ['static/m_gestic_listen_neutral_01', 'static/f_gestic_listen_neutral_01', { loop: 1 }],
  listen2: ['static/m_gestic_listen_neutral_02', 'static/f_gestic_listen_neutral_02', { loop: 1 }],
  nod: ['static/m_gestic_listen_accept_01', 'static/f_gestic_listen_accept_01', {}],
  shake: ['static/m_gestic_listen_deny_01', 'static/f_gestic_listen_deny_01', {}],
  // one-shots
  laugh: ['static/m_gestic_laugh_loud', 'static/f_gestic_laugh_loud', { max: 6 }],
  laughLow: ['static/m_gestic_laugh_low', 'static/f_gestic_laugh_low', { max: 5 }],
  shrug: ['static/m_gestic_shrug_01', 'static/f_gestic_shrug_01', {}],
  thoughtful: ['static/m_gestic_thoughtful_01', 'static/f_gestic_thoughtful_01', { max: 8 }],
  phone: ['static/m_cell_phone_talk_01', 'xyz/f_cell_phone_talk_01', { loop: 1, max: 12 }],
  phoneText: ['static/m_cell_phone_textmessage', 'static/f_cell_phone_textmessage', { loop: 1, max: 12 }],
  photo: ['static/m_take_picture', 'static/f_take_picture', { max: 9 }],
  wave: ['static/m_wave_01', 'static/f_wave_01', {}],
  documents: ['static/m_documents_check', 'static/f_documents_check', { loop: 1, max: 12 }],
  drink: ['static/m_drink_drinking', 'static/f_drink_drinking', { max: 8 }],
  // seated
  sitTable: ['static/m_sit_table_breathe_01', 'static/f_sit_table_breathe_01', { loop: 1 }],
  sitTable2: ['static/m_sit_table_idle_neutral_01', 'static/f_sit_table_idle_neutral_01', { loop: 1 }],
  sitTableLook: ['static/m_sit_table_idle_look_around', 'static/f_sit_table_idle_look_around', { loop: 1 }],
  sitTableThink: ['static/m_sit_table_gestic_thoughtful', 'static/f_sit_table_gestic_thoughtful', { max: 9 }],
  sitTableShrug: ['static/m_sit_table_gestic_shrug_01', 'static/f_sit_table_gestic_shrug_01', {}],
  sitChair: ['static/m_sit_chair_breathe_01', 'static/f_sit_chair_breathe_01', { loop: 1 }],
  sitChair2: ['static/m_sit_chair_idle_neutral_01', 'static/f_sit_chair_idle_neutral_01', { loop: 1 }],
  sitChairThink: ['static/m_sit_chair_gestic_thoughtful', 'static/f_sit_chair_gestic_thoughtful', { max: 9 }],
  sitChairLook: ['static/m_sit_chair_idle_look_around', 'static/f_sit_chair_idle_look_around', { loop: 1 }],
};

/** Face blendshapes kept from Rocketbox's 175 (ARKit names + Oculus visemes). */
export const MORPHS = [
  'AK_09_EyeBlinkLeft', 'AK_10_EyeBlinkRight', 'AK_19_EyeSquintLeft', 'AK_20_EyeSquintRight', 'AK_21_EyeWideLeft', 'AK_22_EyeWideRight',
  'AK_01_BrowDownLeft', 'AK_02_BrowDownRight', 'AK_03_BrowInnerUp', 'AK_04_BrowOuterUpLeft', 'AK_05_BrowOuterUpRight',
  'AK_07_CheekSquintLeft', 'AK_08_CheekSquintRight', 'AK_25_JawOpen', 'AK_32_MouthFunnel', 'AK_38_MouthPucker',
  'AK_44_MouthSmileLeft', 'AK_45_MouthSmileRight', 'AK_30_MouthFrownLeft', 'AK_31_MouthFrownRight',
  'AK_46_MouthStretchLeft', 'AK_47_MouthStretchRight', 'AK_36_MouthPressLeft', 'AK_37_MouthPressRight',
  'AK_42_MouthShrugLower', 'AK_43_MouthShrugUpper', 'AK_48_MouthUpperUpLeft', 'AK_49_MouthUpperUpRight',
  'AK_34_MouthLowerDownLeft', 'AK_35_MouthLowerDownRight', 'AK_50_NoseSneerLeft', 'AK_51_NoseSneerRight',
  'AK_28_MouthDimpleLeft', 'AK_29_MouthDimpleRight', 'AK_40_MouthRollLower', 'AK_27_MouthClose',
  'AA_VI_01_PP', 'AA_VI_02_FF', 'AA_VI_10_aa', 'AA_VI_11_E', 'AA_VI_12_I', 'AA_VI_13_O', 'AA_VI_14_U',
];
