/**
 * Operation modes ("op modes") of a terminal. The device spec is not final
 * yet, so `OTHER` + the free-text `Device.typeLabel` column carry anything
 * not covered here. Add members; never renumber the string values.
 */
export enum DeviceType {
  CAR_WASH = 'car_wash',
  BARRIER = 'barrier',
  PARKING = 'parking',
  VACUUM = 'vacuum',
  OTHER = 'other',
}
