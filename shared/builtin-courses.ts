import raw from './tutorial-course.json';
import {validateCourseMap,type Course} from './courses';

// Curated, released course. No fabricated first-clear record is attached.
const id='user-ba51cc1a5500000001';
export const BUILTIN_COURSES:readonly Course[]=[{
 id,author:'kdking-tools',authorName:'kdking-tools',createdAt:1793314800000,status:'released',
 map:{...validateCourseMap(raw),id},
}];
export const isBuiltinCourse=(id:string)=>BUILTIN_COURSES.some(c=>c.id===id);
