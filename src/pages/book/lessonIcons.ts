import type { SvgIconComponent } from "@mui/icons-material";
import DirectionsRunOutlined from "@mui/icons-material/DirectionsRunOutlined";
import ExtensionOutlined from "@mui/icons-material/ExtensionOutlined";
import PsychologyOutlined from "@mui/icons-material/PsychologyOutlined";
import RecordVoiceOverOutlined from "@mui/icons-material/RecordVoiceOverOutlined";
import SpaOutlined from "@mui/icons-material/SpaOutlined";
import TouchAppOutlined from "@mui/icons-material/TouchAppOutlined";

// Значок плитки занятия по ключевым словам названия (ru/ky/uz). Названия задаёт
// Академия, поэтому совпадение не гарантировано: без него плитка покажет первую букву —
// чужой значок хуже буквы («массаж» с рупором логопеда читается ошибкой).

const RULES: Array<[RegExp, SvgIconComponent]> = [
  [/логопед|logoped|речь|нутк|nutq/i, RecordVoiceOverOutlined],
  [/психолог|psixolog|psycholog/i, PsychologyOutlined],
  [/дефектолог|defektolog|аба[- ]?терап|aba[- ]?terap/i, ExtensionOutlined],
  [/сенсор|sensor/i, TouchAppOutlined],
  [/афк|лфк|физкульт|jismoniy|kineziolog|кинезиолог/i, DirectionsRunOutlined],
  [/массаж|massaj/i, SpaOutlined],
];

export function lessonIcon(name: string): SvgIconComponent | null {
  return RULES.find(([pattern]) => pattern.test(name))?.[1] ?? null;
}
