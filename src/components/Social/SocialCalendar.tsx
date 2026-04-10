/**
 * Social Calendar — Monthly editorial calendar with events and posts.
 */
import { memo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { fetchCalendarEvents, type SocialCalendarEvent } from '@/lib/api/socialHub';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { SIMULATED_CALENDAR_EVENTS } from '@/data/socialSimulatedData';

interface SocialCalendarProps {
  trackedSiteId: string;
  onCreatePost?: (date: string) => void;
}

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export const SocialCalendar = memo(function SocialCalendar({ trackedSiteId, onCreatePost }: SocialCalendarProps) {
  const { isDemoMode } = useDemoMode();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<SocialCalendarEvent[]>([]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

  useEffect(() => {
    if (isDemoMode) {
      setEvents(SIMULATED_CALENDAR_EVENTS as unknown as SocialCalendarEvent[]);
      return;
    }
    if (!trackedSiteId) return;
    fetchCalendarEvents(trackedSiteId, monthStr).then(setEvents).catch(console.error);
  }, [trackedSiteId, monthStr, isDemoMode]);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getEventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.event_date === dateStr);
  };

  const today = new Date();
  const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <CardTitle className="text-base">{MONTHS_FR[month]} {year}</CardTitle>
          <Button variant="ghost" size="sm" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        <div className="grid grid-cols-7 gap-px">
          {DAYS_FR.map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
          ))}
          {Array.from({ length: startOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[80px]" />
          ))}
          {Array.from({ length: totalDays }).map((_, i) => {
            const day = i + 1;
            const dayEvents = getEventsForDay(day);
            return (
              <div
                key={day}
                className={`min-h-[80px] border border-border rounded-md p-1 text-xs cursor-pointer hover:bg-muted/50 transition-colors ${isToday(day) ? 'bg-primary/5 border-primary/30' : ''}`}
                onClick={() => onCreatePost?.(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)}
              >
                <span className={`font-medium ${isToday(day) ? 'text-primary' : 'text-foreground'}`}>{day}</span>
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 2).map(ev => (
                    <div key={ev.id} className="truncate px-1 py-0.5 rounded text-[10px]" style={{ backgroundColor: ev.color + '20', color: ev.color }}>
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 2}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});
