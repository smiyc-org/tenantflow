import { SLA_DEFAULTS } from '@tenantflow/shared';
import type { SlaConfig } from '@tenantflow/shared';

export class SlaManager {
  computeDeadline(slaHours: number, from: Date = new Date()): Date {
    return new Date(from.getTime() + slaHours * 60 * 60 * 1000);
  }

  computeSlaConfig(
    slaHours: number,
    escalationOid: string | undefined,
    from: Date = new Date(),
  ): SlaConfig {
    const deadline = this.computeDeadline(slaHours, from);
    const firstReminderAt = new Date(
      from.getTime() +
        slaHours * SLA_DEFAULTS.FIRST_REMINDER_FRACTION * 60 * 60 * 1000,
    );
    const escalationAt = new Date(
      deadline.getTime() +
        SLA_DEFAULTS.ESCALATION_GRACE_HOURS * 60 * 60 * 1000,
    );

    return {
      slaHours,
      firstReminderAt,
      escalationAt,
      escalationOid,
    };
  }

  isBreached(deadline: Date, now: Date = new Date()): boolean {
    return now > deadline;
  }

  isReminderDue(reminderAt: Date, alreadySent: boolean, now: Date = new Date()): boolean {
    return !alreadySent && now >= reminderAt;
  }

  minutesUntilDeadline(deadline: Date, now: Date = new Date()): number {
    return Math.floor((deadline.getTime() - now.getTime()) / 60000);
  }
}
