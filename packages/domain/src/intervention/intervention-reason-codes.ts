/** Reason codes recorded on each intervention transition (T§4). */
export const INTERVENTION_REASON = {
  thresholdExceeded: 'SG-RD-50_THRESHOLD_EXCEEDED',
  coolingPeriodElapsed: 'SG-RD-50_COOLING_PERIOD_ELAPSED',
  customerVerifiedRelease: 'CUSTOMER_VERIFIED_RELEASE',
  customerCancelled: 'CUSTOMER_CANCELLED',
  analystConfirmedFraud: 'ANALYST_CONFIRMED_FRAUD',
} as const;
