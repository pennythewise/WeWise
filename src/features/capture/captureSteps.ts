import { L } from '@/engine/l';

export interface CaptureStep { id: string; title: L; guide: L; ready: L; zoom: { scale: number; ox: number; oy: number } }
export const STEPS: CaptureStep[] = [
  { id: 'wide', title: L('Whole vehicle', '车辆全貌'), guide: L('Step back until the whole car fits in the frame', '后退一些，让整辆车都在画面内'), ready: L('Good distance', '距离合适'), zoom: { scale: 1, ox: 50, oy: 50 } },
  { id: 'damage', title: L('Close-up of the damage', '损坏部位特写'), guide: L('Move closer to the damaged area', '靠近受损部位'), ready: L('Damage in focus', '受损部位已对焦'), zoom: { scale: 2.3, ox: 56, oy: 54 } },
  { id: 'plate', title: L('Number plate', '车牌'), guide: L('Show the number plate clearly', '让车牌清晰入镜'), ready: L('Plate readable', '车牌清晰可读'), zoom: { scale: 3, ox: 24, oy: 60 } },
  { id: 'scene', title: L('Surroundings', '周边环境'), guide: L('Capture the road and nearby signs', '拍摄道路和附近标志'), ready: L('Scene captured', '场景已捕捉'), zoom: { scale: 1.35, ox: 82, oy: 36 } },
];
export const READY_AFTER_MS = 1600;
