import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CalendarIcon, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Granularity, TimeRangePreset, TrackedSiteOption } from './types';

interface Props {
  sites: TrackedSiteOption[];
  siteId: string;
  onSiteChange: (id: string) => void;
  preset: TimeRangePreset;
  onPresetChange: (p: TimeRangePreset) => void;
  customStart: Date | undefined;
  customEnd: Date | undefined;
  onCustomChange: (start: Date | undefined, end: Date | undefined) => void;
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  channelGroup: string;
  onChannelGroupChange: (c: string) => void;
  compare: boolean;
  onCompareChange: (b: boolean) => void;
  onRefresh: () => void;
  loading: boolean;
}

const PRESETS: { value: TimeRangePreset; label: string }[] = [
  { value: '7d', label: '7 jours' },
  { value: '28d', label: '28 jours' },
  { value: '90d', label: '90 jours' },
  { value: '6m', label: '6 mois' },
  { value: '12m', label: '12 mois' },
  { value: 'custom', label: 'Personnalisé' },
];

const GRANULARITIES: { value: Granularity; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
];

const CHANNELS = [
  { value: 'all', label: 'Toutes les sources' },
  { value: 'Organic Search', label: 'Organique' },
  { value: 'Direct', label: 'Direct' },
  { value: 'Referral', label: 'Référents' },
  { value: 'Organic Social', label: 'Social' },
  { value: 'Paid Search', label: 'Payant' },
  { value: 'Email', label: 'Email' },
];

export function GA4Toolbar(props: Props) {
  const [openStart, setOpenStart] = useState(false);
  const [openEnd, setOpenEnd] = useState(false);

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card/30 p-3">
      {/* Site */}
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase text-muted-foreground">Site</Label>
        <Select value={props.siteId} onValueChange={props.onSiteChange}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue placeholder="Sélectionner un site" />
          </SelectTrigger>
          <SelectContent>
            {props.sites.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {s.site_name || s.domain}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Preset */}
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase text-muted-foreground">Plage</Label>
        <Select value={props.preset} onValueChange={(v) => props.onPresetChange(v as TimeRangePreset)}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value} className="text-xs">
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Custom dates */}
      {props.preset === 'custom' && (
        <>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Début</Label>
            <Popover open={openStart} onOpenChange={setOpenStart}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('h-8 w-[140px] justify-start text-xs', !props.customStart && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {props.customStart ? format(props.customStart, 'dd/MM/yyyy') : 'Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={props.customStart}
                  onSelect={(d) => {
                    props.onCustomChange(d, props.customEnd);
                    setOpenStart(false);
                  }}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] uppercase text-muted-foreground">Fin</Label>
            <Popover open={openEnd} onOpenChange={setOpenEnd}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('h-8 w-[140px] justify-start text-xs', !props.customEnd && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-3 w-3" />
                  {props.customEnd ? format(props.customEnd, 'dd/MM/yyyy') : 'Date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={props.customEnd}
                  onSelect={(d) => {
                    props.onCustomChange(props.customStart, d);
                    setOpenEnd(false);
                  }}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>
        </>
      )}

      {/* Granularity */}
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase text-muted-foreground">Échelle</Label>
        <Select value={props.granularity} onValueChange={(v) => props.onGranularityChange(v as Granularity)}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GRANULARITIES.map((g) => (
              <SelectItem key={g.value} value={g.value} className="text-xs">
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Channel group */}
      <div className="flex flex-col gap-1">
        <Label className="text-[10px] uppercase text-muted-foreground">Source</Label>
        <Select value={props.channelGroup} onValueChange={props.onChannelGroupChange}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map((c) => (
              <SelectItem key={c.value} value={c.value} className="text-xs">
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Compare */}
      <div className="flex items-center gap-2 self-end pb-1">
        <Switch id="ga4-compare" checked={props.compare} onCheckedChange={props.onCompareChange} />
        <Label htmlFor="ga4-compare" className="cursor-pointer text-xs">
          Comparer N-1
        </Label>
      </div>

      {/* Refresh */}
      <Button
        variant="outline"
        size="sm"
        className="ml-auto h-8 self-end text-xs"
        onClick={props.onRefresh}
        disabled={props.loading}
      >
        <RefreshCw className={cn('mr-1.5 h-3 w-3', props.loading && 'animate-spin')} />
        Rafraîchir
      </Button>
    </div>
  );
}
