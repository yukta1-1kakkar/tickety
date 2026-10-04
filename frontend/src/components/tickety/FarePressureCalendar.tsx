import holidayCalendar from '../../../../config/holidays.json';
import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { dateLabel, routeLabel } from './data';

type Holiday = { name: string; kind: 'festival' | 'public' };

const HOLIDAYS_2026 = holidayCalendar.events as Record<string, Holiday>;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function keyFor(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function nearbyHoliday(date: Date) {
  for (const offset of [-1, 1, -2, 2, -3, 3]) {
    const nearby = new Date(date);
    nearby.setDate(date.getDate() + offset);
    const holiday = HOLIDAYS_2026[keyFor(nearby)];
    if (holiday) return { holiday, offset };
  }
  return null;
}

export function FarePressureCalendar({ departureDate, routeId }: { departureDate: string; routeId: string }) {
  const selectedDate = useMemo(() => dateFromKey(departureDate), [departureDate]);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const selectedKey = keyFor(selectedDate);
  const monthLabel = visibleMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const cells = useMemo(() => {
    const start = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [visibleMonth]);
  const selectedHoliday = HOLIDAYS_2026[selectedKey];
  const selectedWeekend = selectedDate.getDay() === 0 || selectedDate.getDay() === 6;
  const adjacent = nearbyHoliday(selectedDate);
  const factors = [
    selectedHoliday && { title: selectedHoliday.name, detail: 'Festival or public-holiday travel can increase demand around this date.', tone: 'festival' },
    selectedWeekend && { title: 'Weekend travel', detail: 'Friday-evening and weekend departures often attract more leisure demand.', tone: 'weekend' },
    adjacent && { title: `Near ${adjacent.holiday.name}`, detail: `${Math.abs(adjacent.offset)} day${Math.abs(adjacent.offset) === 1 ? '' : 's'} ${adjacent.offset < 0 ? 'after' : 'before'} a holiday, creating possible long-weekend pressure.`, tone: 'nearby' },
  ].filter(Boolean) as { title: string; detail: string; tone: string }[];

  return <section className="tk-section tk-demand-calendar-section" id="price-trends" aria-label="Fare pressure calendar">
    <div className="tk-section-heading"><div><p className="tk-kicker">Calendar context</p><h2>Why this travel date may be busier</h2><p>Calendar events that can add demand pressure around {dateLabel(departureDate)}.</p></div></div>
    <div className="tk-demand-calendar-layout">
      <div className="tk-demand-calendar-card">
        <div className="tk-calendar-toolbar"><div className="tk-calendar-month"><span><CalendarDays size={18} /></span><div><small>Travel calendar</small><strong>{monthLabel}</strong></div></div><div className="tk-calendar-actions"><button onClick={() => setVisibleMonth(value => new Date(value.getFullYear(), value.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={17} /></button><button onClick={() => setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1))}>Travel month</button><button onClick={() => setVisibleMonth(value => new Date(value.getFullYear(), value.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={17} /></button></div></div>
        <div className="tk-calendar-weekdays">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div>
        <div className="tk-calendar-grid">{cells.map(date => {
          const key = keyFor(date);
          const holiday = HOLIDAYS_2026[key];
          const proximity = holiday ? null : nearbyHoliday(date);
          const weekend = date.getDay() === 0 || date.getDay() === 6;
          const outside = date.getMonth() !== visibleMonth.getMonth();
          const selected = key === selectedKey;
          return <div key={key} className={`tk-calendar-day${outside ? ' is-outside' : ''}${weekend ? ' is-weekend' : ''}${holiday ? ' is-holiday' : ''}${proximity ? proximity.offset > 0 ? ' is-before-event' : ' is-after-event' : ''}${selected ? ' is-selected' : ''}`} aria-label={`${dateLabel(key)}${holiday ? `, ${holiday.name}` : ''}${weekend ? ', weekend' : ''}${selected ? ', selected travel date' : ''}`}>
            <span>{date.getDate()}</span>{holiday && <small><i />{holiday.name}</small>}{proximity && <small className="tk-event-proximity">{Math.abs(proximity.offset)}d {proximity.offset > 0 ? 'before' : 'after'} {proximity.holiday.name}</small>}{selected && <b>Travel day</b>}
          </div>;
        })}</div>
        <div className="tk-calendar-legend"><span><i className="is-travel" /> Travel date</span><span><i className="is-festival" /> Festival / holiday</span><span><i className="is-weekend" /> Weekend</span><span><i className="is-before-event" /> 3 days before</span><span><i className="is-after-event" /> 3 days after</span></div>
      </div>
      <aside className="tk-calendar-insights"><p className="tk-kicker">{routeLabel(routeId)}</p><h3>{dateLabel(departureDate)}</h3>{factors.length ? <div>{factors.map(factor => <article key={factor.title} className={`tk-calendar-factor tk-calendar-factor-${factor.tone}`}><Sparkles size={16} /><div><strong>{factor.title}</strong><p>{factor.detail}</p></div></article>)}</div> : <article className="tk-calendar-factor"><CalendarDays size={16} /><div><strong>No major calendar pressure flagged</strong><p>The fare may still move because of inventory, search demand, airline pricing, or events not represented here.</p></div></article>}<p className="tk-calendar-disclaimer">These markers provide context, not proof of what caused a fare change. Regional holidays and local events may vary.</p></aside>
    </div>
  </section>;
}
