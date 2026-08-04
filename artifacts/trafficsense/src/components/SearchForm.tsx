import { useState, useRef, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation, Calendar, Clock, Loader2, ArrowRight } from 'lucide-react';
import { usePredictTraffic } from '@workspace/api-client-react';

const formSchema = z.object({
  origin: z.string().min(1, 'Origin is required'),
  destination: z.string().min(1, 'Destination is required'),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
});

type FormValues = z.infer<typeof formSchema>;

function nowDefaults() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return { date, time };
}

interface Suggestion {
  label: string;  // short, Google-Maps-style display text
  value: string;  // full address — used for the actual geocoding/predict call
  lat: number;
  lng: number;
}

/** Debounced autocomplete text input with a dropdown of place suggestions */
function AutocompleteInput({
  value,
  onChange,
  placeholder,
  dotClassName,
  testId,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  dotClassName: string;
  testId: string;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      // Cancel any in-flight request so slow/stale responses don't
      // overwrite the dropdown with outdated results.
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode-search?q=${encodeURIComponent(value)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
        setOpen(true);
      } catch {
        // ignore aborted/failed requests
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={wrapperRef}>
      <div className={`absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 ${dotClassName}`} />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className="pl-7 bg-muted/30 border-border/60 focus:border-sky-500/50 h-10 text-sm placeholder:text-muted-foreground/50"
        data-testid={testId}
        autoComplete="off"
      />
      {open && (suggestions.length > 0 || loading) && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border/60 bg-popover shadow-lg max-h-56 overflow-y-auto">
          {loading && suggestions.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Searching...</div>
          )}
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                // Store the full address for accurate geocoding,
                // but the user only sees the short label while typing.
                onChange(s.value);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 border-b border-border/30 last:border-b-0"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface SearchFormProps {
  onResult: (result: any) => void;
  onLoading: (isLoading: boolean) => void;
  onError: (error: boolean) => void;
}

export default function SearchForm({ onResult, onLoading, onError }: SearchFormProps) {
  const defaults = nowDefaults();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { origin: '', destination: '', date: defaults.date, time: defaults.time },
  });

  const predictTraffic = usePredictTraffic({
    mutation: {
      onMutate: () => { onLoading(true); onError(false); },
      onSuccess: (data) => { onResult(data); onLoading(false); },
      onError: () => { onError(true); onLoading(false); },
    },
  });

  const onSubmit = (values: FormValues) => {
    const parsed = new Date(`${values.date}T${values.time}:00`);
    if (isNaN(parsed.getTime())) {
      form.setError('date', { message: 'Invalid date or time — please re-enter.' });
      return;
    }
    predictTraffic.mutate({
      data: { origin: values.origin, destination: values.destination, datetime: parsed.toISOString() },
    });
  };

  const isPending = predictTraffic.isPending;

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border/50 bg-gradient-to-r from-sky-500/5 to-teal-500/5 flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center shadow-sm">
          <Navigation className="w-3.5 h-3.5 text-white" />
        </div>
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Route Configuration</h2>
      </div>

      <div className="p-5">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="predict-form">

            {/* Origin */}
            <FormField
              control={form.control}
              name="origin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-sky-400" /> Origin
                  </FormLabel>
                  <FormControl>
                    <AutocompleteInput
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="e.g. MG Road, Bangalore"
                      dotClassName="rounded-full bg-sky-500 ring-2 ring-sky-500/20"
                      testId="input-origin"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {/* Connector dots */}
            <div className="flex items-center gap-2 px-1 -my-1">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="w-px h-1.5 bg-border/50 ml-0.5" />
              ))}
            </div>

            {/* Destination */}
            <FormField
              control={form.control}
              name="destination"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Navigation className="w-3 h-3 text-teal-400" /> Destination
                  </FormLabel>
                  <FormControl>
                    <AutocompleteInput
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="e.g. Kempegowda Airport, Bangalore"
                      dotClassName="rounded-sm bg-teal-500 ring-2 ring-teal-500/20 rotate-45"
                      testId="input-destination"
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-primary" /> Date
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="date"
                        className="bg-muted/30 border-border/60 focus:border-primary/50 h-10 text-sm"
                        data-testid="input-date"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-primary" /> Time
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="time"
                        className="bg-muted/30 border-border/60 focus:border-primary/50 h-10 text-sm"
                        data-testid="input-time"
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={isPending}
              className="w-full h-10 bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 text-white font-semibold text-sm shadow-md shadow-sky-500/20 hover:shadow-sky-500/40 transition-all border-0"
              data-testid="button-predict"
            >
              {isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Running Model...</>
              ) : (
                <>Run Prediction<ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}