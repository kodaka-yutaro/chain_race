import type {MapDef} from './physics';
const custom=new Map<string,MapDef>();
export function registerCourse(map:MapDef){custom.set(map.id,structuredClone(map));}
export const stageById=(id:string)=>custom.get(id);
export const mapById=stageById;
