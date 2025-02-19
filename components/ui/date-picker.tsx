"use client"

import type React from "react"

import { useState } from "react"

interface DatePickerProps {
  date: Date
  setDate: (date: Date) => void
}

export const DatePicker = ({ date, setDate }: DatePickerProps) => {
  const [selectedDate, setSelectedDate] = useState(date)

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(event.target.value)
    if (!isNaN(newDate.getTime())) {
      setSelectedDate(newDate)
      setDate(newDate)
    }
  }

  return <input type="date" value={selectedDate.toISOString().slice(0, 10)} onChange={handleDateChange} />
}

