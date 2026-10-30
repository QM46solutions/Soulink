// Pieces of the ads dashboards (customer "My ads" and the team's Ads Manager):
//  StatTile   – one number with its label (and an optional line under it)
//  MoneyBar   – spent vs budget (how much is left), as one bar
//  DailyBars  – views per day for the last 30 days; tap / hover a day for its views and clicks
//  StatusChip – Running · Paused · Budget used · Ended · Starts soon
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, space } from '../lib/theme';

export const inr = (n) => (n == null ? '–' : `₹${Number(n).toLocaleString('en-IN')}`);
export const num = (n) => Number(n || 0).toLocaleString('en-IN');

export function StatTile({ label, value, sub, tone }) {
  return (
    <View style={{ flex: 1, minWidth: 140, padding: space.md, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: colors.muted }}>{label}</Text>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 22, color: tone || colors.text, marginTop: 4 }}>{value}</Text>
      {sub ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}

/** Spent vs budget: the filled part is spent, the rest is what's left. */
export function MoneyBar({ spent, budget, height = 10 }) {
  if (!budget) return null;
  const pct = Math.max(0, Math.min(1, spent / budget));
  return (
    <View>
      <View style={{ height, borderRadius: height / 2, backgroundColor: colors.border, overflow: 'hidden', flexDirection: 'row' }}>
        <View style={{ width: `${pct * 100}%`, backgroundColor: pct >= 0.9 ? colors.spark : colors.soul, borderRadius: height / 2 }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.text }}>{inr(spent)} spent</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.muted }}>{inr(Math.max(0, budget - spent))} left of {inr(budget)}</Text>
      </View>
    </View>
  );
}

const STATUS = {
  running: ['Running', colors.mint, 'radio-button-on'], paused: ['Paused', colors.muted, 'pause-circle'],
  budget_used: ['Budget used up', colors.spark, 'alert-circle'], ended: ['Ended', colors.muted, 'checkmark-circle'], scheduled: ['Starts soon', colors.gold, 'time'],
};
export function StatusChip({ status }) {
  const [label, color, icon] = STATUS[status] || STATUS.paused;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: colors.border }}>
      <Ionicons name={icon} size={12} color={color} style={{ marginRight: 4 }} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, color: colors.text }}>{label}</Text>
    </View>
  );
}

const dayLabel = (d) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Views per day (one series, one colour); tap or hover a bar to read that day. */
export function DailyBars({ days, height = 120 }) {
  const [sel, setSel] = useState(null);
  if (!days?.length) return null;
  const max = Math.max(1, ...days.map((d) => d.views));
  const total = days.reduce((t, d) => t + d.views, 0);
  const shown = sel != null ? days[sel] : null;
  return (
    <View>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12.5, color: colors.muted, minHeight: 18 }}>
        {shown ? `${dayLabel(shown.day)} · ${num(shown.views)} views · ${num(shown.clicks)} taps` : `${num(total)} views in the last ${days.length} days · tap a day`}
      </Text>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', marginTop: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}
        accessibilityLabel={`Views per day, last ${days.length} days, ${num(total)} in total`}>
        {days.map((d, i) => (
          <Pressable key={d.day} onPress={() => setSel(sel === i ? null : i)} onHoverIn={() => setSel(i)} onHoverOut={() => setSel(null)}
            style={{ flex: 1, height: '100%', justifyContent: 'flex-end', paddingHorizontal: 1 }} accessibilityLabel={`${dayLabel(d.day)}: ${d.views} views`}>
            <View style={{ height: Math.max(d.views ? 3 : 1, (d.views / max) * (height - 4)), borderTopLeftRadius: 4, borderTopRightRadius: 4,
              backgroundColor: sel === i ? colors.spark : d.views ? colors.soul : colors.border }} />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.dim }}>{dayLabel(days[0].day)}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.dim }}>Today</Text>
      </View>
    </View>
  );
}

/** Advice lines (top up, extend, change the picture, best placement, payment due). */
const TIP_ICON = { topup: ['add-circle', colors.gold], extend: ['calendar', colors.aura], creative: ['image', colors.spark], winner: ['trophy', colors.mint], placement: ['compass', colors.aura], payment: ['card', colors.spark] };
export function Tips({ tips }) {
  if (!tips?.length) return null;
  return tips.map((t, i) => {
    const [icon, color] = TIP_ICON[t.kind] || ['bulb', colors.aura];
    return (
      <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', padding: space.md, marginTop: space.sm, borderRadius: 14, backgroundColor: 'rgba(124,92,252,0.1)', borderWidth: 1, borderColor: 'rgba(124,92,252,0.25)' }}>
        <Ionicons name={icon} size={18} color={color} style={{ marginRight: 10, marginTop: 1 }} />
        <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.text }}>{t.text}</Text>
      </View>
    );
  });
}
