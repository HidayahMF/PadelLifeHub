import { Component, computed, inject, input } from '@angular/core';
import { IconComponent } from '../../../layout/components/icon.component';
import { I18nService } from '../../../core/services/i18n.service';
import { getLocale } from '../../../core/utils/locale';
import type { InsightsData } from '../../../core/models/misc.model';
import { formatCurrency } from '../../../core/utils/format';

interface InsightCard {
  icon: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  text: string;
}

const TONE_CLASS: Record<InsightCard['tone'], string> = {
  primary: 'bg-primary/20 text-ink',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/20 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-accent/10 text-ink',
};

@Component({
  selector: 'app-insights',
  standalone: true,
  imports: [IconComponent],
  host: { class: 'block' },
  template: `
    <div>
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <h2 class="text-base font-bold text-ink">{{ t('Financial insights') }}</h2>
        <span class="text-xs font-medium text-ink-faint">{{ t('Computed from your data · {month}', { month: month() }) }}</span>
      </div>
      @if (cards().length === 0) {
        <p class="py-6 text-center text-sm text-ink-soft">
          {{ t('Add a few transactions to unlock financial insights.') }}
        </p>
      } @else {
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          @for (card of cards(); track card.text) {
            <div
              class="flex items-start gap-3 rounded-card border-2 border-ink bg-surface p-4 shadow-soft transition-transform duration-150 hover:-translate-y-0.5"
            >
              <span
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border-2 border-ink shadow-[2px_2px_0_0_var(--color-ink)]"
                [class]="TONE_CLASS[card.tone]"
              >
                <app-icon [name]="card.icon" [size]="18" [strokeWidth]="2.4" />
              </span>
              <p class="text-sm font-medium leading-relaxed text-ink">{{ card.text }}</p>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class InsightsComponent {
  readonly insights = input<InsightsData | null>(null);
  private i18n = inject(I18nService);

  protected readonly t = this.i18n.t.bind(this.i18n);

  protected readonly TONE_CLASS = TONE_CLASS;

  protected readonly month = computed(() => {
    const m = this.insights()?.month;
    if (!m) return '';
    const [y, mo] = m.split('-').map(Number);
    return new Intl.DateTimeFormat(getLocale(), { month: 'long', year: 'numeric' }).format(
      new Date(y, mo - 1, 1)
    );
  });

  protected readonly cards = computed<InsightCard[]>(() => {
    const i = this.insights();
    if (!i) return [];
    const out: InsightCard[] = [];

    // Weekend vs weekday spending.
    const { weekendAvg, weekdayAvg } = i.weekendVsWeekday;
    if (weekendAvg > 0 || weekdayAvg > 0) {
      const pct = weekdayAvg > 0 ? ((weekendAvg - weekdayAvg) / weekdayAvg) * 100 : 100;
      out.push({
        icon: 'calendar-days',
        tone: 'primary',
        text:
          pct >= 0
            ? this.t('You spend {pct}% more per day on weekends than on weekdays.', {
                pct: Math.abs(pct).toFixed(0),
              })
            : this.t('You spend {pct}% less per day on weekends than on weekdays.', {
                pct: Math.abs(pct).toFixed(0),
              }),
      });
    }

    // Savings rate vs last month.
    if (i.income.thisMonth > 0) {
      const delta = i.savingsRate - i.savingsRateLastMonth;
      out.push({
        icon: 'piggy-bank',
        tone: delta >= 0 ? 'success' : 'warning',
        text:
          delta >= 0
            ? this.t('Your savings rate is {rate}% of income this month, up {delta} pts vs last month.', {
                rate: i.savingsRate.toFixed(0),
                delta: Math.abs(delta).toFixed(1),
              })
            : this.t('Your savings rate is {rate}% of income this month, down {delta} pts vs last month.', {
                rate: i.savingsRate.toFixed(0),
                delta: Math.abs(delta).toFixed(1),
              }),
      });
    }

    // Largest spending category.
    if (i.largestCategory && i.largestCategory.total > 0) {
      out.push({
        icon: 'receipt',
        tone: 'warning',
        text: this.t('{name} is your largest expense category — {pct}% of spending in the last 30 days.', {
          name: i.largestCategory.name,
          pct: i.largestCategory.pct.toFixed(0),
        }),
      });
    }

    // Month-over-month comparison.
    if (i.expense.lastMonth > 0 || i.monthOverMonth.diff !== 0) {
      const diff = i.monthOverMonth.diff;
      out.push({
        icon: diff > 0 ? 'trending-up' : 'trending-down',
        tone: diff > 0 ? 'danger' : 'success',
        text:
          diff > 0
            ? this.t('You spent {amount} more than last month ({pct}%).', {
                amount: formatCurrency(Math.abs(diff)),
                pct: Math.abs(i.monthOverMonth.pct).toFixed(0),
              })
            : this.t('You spent {amount} less than last month ({pct}%).', {
                amount: formatCurrency(Math.abs(diff)),
                pct: Math.abs(i.monthOverMonth.pct).toFixed(0),
              }),
      });
    }

    // Budget adherence.
    if (i.budget.count > 0) {
      out.push({
        icon: 'gauge',
        tone: i.budget.overBudget.length > 0 ? 'danger' : 'primary',
        text:
          i.budget.overBudget.length > 0
            ? this.t('Heads up: {list} is over budget — {pct}% of your total budget is used.', {
                list:
                  i.budget.overBudget.slice(0, 2).join(', ') +
                  (i.budget.overBudget.length > 2
                    ? ' ' + this.t('+{n} more', { n: i.budget.overBudget.length - 2 })
                    : ''),
                pct: i.budget.pct.toFixed(0),
              })
            : this.t("You've used {pct}% of this month's budget.", {
                pct: i.budget.pct.toFixed(0),
              }),
      });
    }

    // Cash flow trend.
    const flows = i.cashFlow.filter((f) => f.net !== 0);
    if (flows.length >= 2) {
      const positive = flows.filter((f) => f.net > 0).length;
      const trend = positive >= Math.ceil(flows.length / 2);
      out.push({
        icon: 'bar-chart-3',
        tone: trend ? 'success' : 'danger',
        text: this.t('Your cash flow was positive in {n} of the last {m} months.', {
          n: positive,
          m: flows.length,
        }),
      });
    }

    return out;
  });
}
