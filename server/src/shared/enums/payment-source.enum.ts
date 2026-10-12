export enum PaymentSource {
  /** Paid straight at the terminal -> money lands in that device's earnings. */
  TERMINAL = 'terminal',
  /** Paid from the in-app user balance (phase 2) -> moved into device earnings. */
  APP_BALANCE = 'app_balance',
  /** Created by an admin by hand (corrections, tests). */
  MANUAL = 'manual',
}
