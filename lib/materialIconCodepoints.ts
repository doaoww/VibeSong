// Material Symbols icons are normally rendered via *ligatures* — you write
// the icon's name ("home") as text and the font's OpenType `liga` feature
// substitutes it with the glyph. That substitution isn't reliably applied by
// every mobile browser/WebView (notably Samsung Internet, and some iOS
// in-app browsers), so the raw ligature text ("home", "close", ...) shows up
// instead of the icon. Referencing the glyph directly by its codepoint skips
// ligature substitution entirely — it's a single-character glyph lookup,
// which every renderer that can show the font at all supports.
//
// Codepoints below are copied verbatim from Google's canonical mapping:
// https://github.com/google/material-design-icons/blob/master/variablefont/MaterialSymbolsOutlined%5BFILL%2CGRAD%2Copsz%2Cwght%5D.codepoints
export const ICON_CODEPOINTS = {
  home: "\u{e9b2}",
  explore: "\u{e87a}",
  library_music: "\u{e030}",
  person: "\u{f0d3}",
  close: "\u{e5cd}",
  menu: "\u{e5d2}",
  share: "\u{e80d}",
  music_note: "\u{e405}",
  favorite: "\u{e87e}",
  arrow_back: "\u{e5c4}",
  add_photo_alternate: "\u{e43e}",
  progress_activity: "\u{e9d0}",
  photo_camera: "\u{e412}",
  error: "\u{f8b6}",
  pause: "\u{e034}",
  play_arrow: "\u{e037}",
  graphic_eq: "\u{e1b8}",
  bolt: "\u{ea0b}",
  music_off: "\u{e440}",
  pause_circle: "\u{e1a2}",
  play_circle: "\u{e1c4}",
  check: "\u{e668}",
  album: "\u{e019}",
} as const;

export type IconName = keyof typeof ICON_CODEPOINTS;
