import type {Input} from './physics';

/** Preserve continuous controls and aim, never replay one-shot commands. */
export function heldInput(input:Input):Input {
  return {...input,kill:false,spit:false,miniSpit:false,clearWord:false,weapon:undefined};
}
