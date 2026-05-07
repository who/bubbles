import Papa from 'papaparse';
import { scaleLinear } from 'd3-scale';
import { timeDay } from 'd3-time';
import { extent } from 'd3-array';
import { format } from 'date-fns';

export const smoke = {
  papa: Papa,
  scaleLinear,
  timeDay,
  extent,
  format,
};
