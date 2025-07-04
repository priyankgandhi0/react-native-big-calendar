import dayjs from "dayjs";
import * as React from "react";
import {
  type AccessibilityProps,
  Platform,
  StyleSheet,
  type TextStyle,
  View,
  type ViewStyle,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { u } from "../commonStyles";
import { useNow } from "../hooks/useNow";
import type {
  CalendarCellStyle,
  EventCellStyle,
  EventRenderer,
  HourRenderer,
  ICalendarEventBase,
} from "../interfaces";
import { useTheme } from "../theme/ThemeContext";
import {
  SIMPLE_DATE_FORMAT,
  enrichEvents,
  getCountOfEventsAtEvent,
  getOrderOfEvent,
  getRelativeTopInDay,
  isToday,
} from "../utils/datetime";
import { typedMemo } from "../utils/react";
import { CalendarEvent } from "./CalendarEvent";
import { HourGuideCell } from "./HourGuideCell";
import { HourGuideColumn } from "./HourGuideColumn";

const styles = StyleSheet.create({
  nowIndicator: {
    position: "absolute",
    zIndex: 10000,
    height: 2,
    width: "100%",
  },
});

interface CalendarBodyProps<T extends ICalendarEventBase> {
  cellHeight: number;
  containerHeight: number;
  dateRange: dayjs.Dayjs[];
  events: T[];
  scrollOffsetMinutes: number;
  ampm: boolean;
  showTime: boolean;
  style: ViewStyle;
  contentContainerStyle?: ViewStyle;
  eventCellTextColor?: string;
  eventCellStyle?: EventCellStyle<T>;
  eventCellAccessibilityProps?: AccessibilityProps;
  calendarCellStyle?: CalendarCellStyle;
  calendarCellAccessibilityProps?: AccessibilityProps;
  hideNowIndicator?: boolean;
  overlapOffset?: number;
  onLongPressCell?: (date: Date) => void;
  onPressCell?: (date: Date) => void;
  onPressEvent?: (event: T) => void;
  renderEvent?: EventRenderer<T>;
  headerComponent?: React.ReactElement | null;
  headerComponentStyle?: ViewStyle;
  hourStyle?: TextStyle;
  hideHours?: boolean;
  minHour?: number;
  maxHour?: number;
  isEventOrderingEnabled?: boolean;
  showWeekNumber?: boolean;
  showVerticalScrollIndicator?: boolean;
  scrollEnabled?: boolean;
  enrichedEventsByDate?: Record<string, T[]>;
  enableEnrichedEvents?: boolean;
  eventsAreSorted?: boolean;
  timeslots?: number;
  hourComponent?: HourRenderer;
}

function _CalendarBody<T extends ICalendarEventBase>({
  containerHeight,
  cellHeight,
  dateRange,
  style,
  contentContainerStyle,
  onLongPressCell,
  onPressCell,
  events,
  onPressEvent,
  eventCellTextColor,
  eventCellStyle,
  eventCellAccessibilityProps = {},
  calendarCellStyle,
  calendarCellAccessibilityProps = {},
  ampm,
  showTime,
  scrollOffsetMinutes,
  hideNowIndicator,
  overlapOffset,
  renderEvent,
  headerComponent = null,
  headerComponentStyle = {},
  hourStyle = {},
  hideHours = false,
  minHour = 0,
  maxHour = 23,
  isEventOrderingEnabled = true,
  showWeekNumber = false,
  showVerticalScrollIndicator = false,
  scrollEnabled = true,
  enrichedEventsByDate,
  enableEnrichedEvents = false,
  eventsAreSorted = false,
  timeslots = 0,
  hourComponent,
}: CalendarBodyProps<T>) {
  const scrollView = React.useRef<ScrollView>(null);
  const { now } = useNow(!hideNowIndicator);
  const hours = Array.from(
    { length: maxHour - minHour + 1 },
    (_, i) => minHour + i
  );

  React.useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (scrollView.current && scrollOffsetMinutes && Platform.OS !== "ios") {
      // We add delay here to work correct on React Native
      // see: https://stackoverflow.com/questions/33208477/react-native-android-scrollview-scrollto-not-working
      timeout = setTimeout(
        () => {
          if (scrollView?.current) {
            scrollView.current.scrollTo({
              y: (cellHeight * scrollOffsetMinutes) / 60,
              animated: false,
            });
          }
        },
        Platform.OS === "web" ? 0 : 10
      );
    }
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [scrollOffsetMinutes, cellHeight]);

  const _onPressCell = React.useCallback(
    (date: dayjs.Dayjs) => {
      onPressCell?.(date.toDate());
    },
    [onPressCell]
  );

  const _onLongPressCell = React.useCallback(
    (date: dayjs.Dayjs) => {
      onLongPressCell?.(date.toDate());
    },
    [onLongPressCell]
  );

  const internalEnrichedEventsByDate = React.useMemo(() => {
    if (enableEnrichedEvents) {
      return enrichedEventsByDate || enrichEvents(events, eventsAreSorted);
    }
    return {};
  }, [enableEnrichedEvents, enrichedEventsByDate, events, eventsAreSorted]);

  const enrichedEvents = React.useMemo(() => {
    if (enableEnrichedEvents) return [];

    if (isEventOrderingEnabled) {
      // Events are being sorted once so we dont have to do it on each loop
      const sortedEvents = events.sort(
        (a, b) => a.start.getDate() - b.start.getDate()
      );
      return sortedEvents.map((event) => ({
        ...event,
        overlapPosition: getOrderOfEvent(event, sortedEvents),
        overlapCount: getCountOfEventsAtEvent(event, sortedEvents),
      }));
    }

    return events;
  }, [enableEnrichedEvents, events, isEventOrderingEnabled]);

  const _renderMappedEvent = React.useCallback(
    (event: T, index: number) => {
      return (
        <CalendarEvent
          key={`${index}${event.start}${event.title}${event.end}`}
          event={event}
          onPressEvent={onPressEvent}
          eventCellStyle={eventCellStyle}
          eventCellAccessibilityProps={eventCellAccessibilityProps}
          eventCellTextColor={eventCellTextColor}
          showTime={showTime}
          eventCount={event.overlapCount}
          eventOrder={event.overlapPosition}
          overlapOffset={overlapOffset}
          renderEvent={renderEvent}
          ampm={ampm}
          maxHour={maxHour}
          minHour={minHour}
          hours={hours.length}
        />
      );
    },
    [
      ampm,
      eventCellStyle,
      eventCellTextColor,
      eventCellAccessibilityProps,
      onPressEvent,
      overlapOffset,
      renderEvent,
      showTime,
      maxHour,
      minHour,
      hours.length,
    ]
  );

  const _renderEvents = React.useCallback(
    (date: dayjs.Dayjs) => {
      if (enableEnrichedEvents) {
        return (
          internalEnrichedEventsByDate[date.format(SIMPLE_DATE_FORMAT)] || []
        ).map(_renderMappedEvent);
      }

      return (
        <>
          {/* Render events of this date */}
          {/* M  T  (W)  T  F  S  S */}
          {/*       S-E             */}
          {(enrichedEvents as T[])
            .filter(({ start }) =>
              dayjs(start).isBetween(
                date.startOf("day"),
                date.endOf("day"),
                null,
                "[)"
              )
            )
            .map(_renderMappedEvent)}

          {/* Render events which starts before this date and ends on this date */}
          {/* M  T  (W)  T  F  S  S */}
          {/* S------E              */}
          {(enrichedEvents as T[])
            .filter(
              ({ start, end }) =>
                dayjs(start).isBefore(date.startOf("day")) &&
                dayjs(end).isBetween(
                  date.startOf("day"),
                  date.endOf("day"),
                  null,
                  "[)"
                )
            )
            .map((event) => ({
              ...event,
              start: dayjs(event.end).startOf("day"),
            }))
            .map(_renderMappedEvent)}

          {/* Render events which starts before this date and ends after this date */}
          {/* M  T  (W)  T  F  S  S */}
          {/*    S-------E          */}
          {(enrichedEvents as T[])
            .filter(
              ({ start, end }) =>
                dayjs(start).isBefore(date.startOf("day")) &&
                dayjs(end).isAfter(date.endOf("day"))
            )
            .map((event) => ({
              ...event,
              start: dayjs(event.end).startOf("day"),
              end: dayjs(event.end).endOf("day"),
            }))
            .map(_renderMappedEvent)}
        </>
      );
    },
    [
      _renderMappedEvent,
      enableEnrichedEvents,
      enrichedEvents,
      internalEnrichedEventsByDate,
    ]
  );

  const theme = useTheme();

  return (
    <React.Fragment>
      {headerComponent != null ? (
        <View style={headerComponentStyle}>{headerComponent}</View>
      ) : null}
      <ScrollView
        style={[
          {
            height: containerHeight - cellHeight * 3,
          },
          style,
        ]}
        ref={scrollView}
        scrollEventThrottle={32}
        showsVerticalScrollIndicator={showVerticalScrollIndicator}
        scrollEnabled={scrollEnabled}
        nestedScrollEnabled
        contentOffset={
          Platform.OS === "ios"
            ? { x: 0, y: scrollOffsetMinutes }
            : { x: 0, y: 0 }
        }
        contentContainerStyle={contentContainerStyle}
      >
        <View
          style={[
            u["flex-1"],
            theme.isRTL ? u["flex-row-reverse"] : u["flex-row"],
          ]}
        >
          {(!hideHours || showWeekNumber) && (
            <View style={[u["z-20"], u["w-50"]]}>
              {hours.map((hour) => (
                <HourGuideColumn
                  key={hour}
                  cellHeight={cellHeight}
                  hour={hour}
                  ampm={ampm}
                  hourStyle={hourStyle}
                  calendarCellAccessibilityProps={
                    calendarCellAccessibilityProps
                  }
                  hourComponent={hourComponent}
                />
              ))}
            </View>
          )}

          {dateRange.map((date) => (
            <View
              style={[u["flex-1"], u["overflow-hidden"]]}
              key={date.toString()}
            >
              {hours.map((hour, index) => (
                <HourGuideCell
                  key={hour}
                  cellHeight={cellHeight}
                  date={date}
                  hour={hour}
                  onLongPress={_onLongPressCell}
                  onPress={_onPressCell}
                  index={index}
                  calendarCellStyle={calendarCellStyle}
                  calendarCellAccessibilityProps={
                    calendarCellAccessibilityProps
                  }
                  timeslots={timeslots}
                />
              ))}
              {_renderEvents(date)}
              {isToday(date) && !hideNowIndicator && (
                <View
                  style={[
                    styles.nowIndicator,
                    { backgroundColor: theme.palette.nowIndicator },
                    {
                      top: `${getRelativeTopInDay(
                        now,
                        minHour,
                        hours.length
                      )}%`,
                    },
                  ]}
                />
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </React.Fragment>
  );
}

export const CalendarBody = typedMemo(_CalendarBody);
