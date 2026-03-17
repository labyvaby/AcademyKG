import { Client, ClientShift } from "./types";
import dayjs from "dayjs";

export const mockClients: Client[] = [
  { id: "c1", fullName: "Иванов Иван Иванович", photoUrl: "https://i.pravatar.cc/150?u=c1" },
  { id: "c2", fullName: "Петрова Анна Сергеевна", photoUrl: "https://i.pravatar.cc/150?u=c2" },
  { id: "c3", fullName: "Сидоров Дмитрий Петрович", photoUrl: "https://i.pravatar.cc/150?u=c3" },
];

export const generateMockShifts = (): ClientShift[] => {
  const shifts: ClientShift[] = [];
  const today = dayjs();
  
  // Добавим несколько смен на текущую неделю
  for (let i = -5; i < 15; i++) {
    const date = today.add(i, 'day').format('YYYY-MM-DD');
    const client = mockClients[((i % mockClients.length) + mockClients.length) % mockClients.length];
    
    shifts.push({
      id: `shift-${i}`,
      clientId: client.id,
      date,
      startTime: "09:00",
      endTime: "18:00",
      isNextWeekEnd: false,
      client
    });
    
    if (i % 3 === 0) {
      shifts.push({
        id: `shift-alt-${i}`,
        clientId: mockClients[((i + 1) % mockClients.length + mockClients.length) % mockClients.length].id,
        date,
        startTime: "14:00",
        endTime: "20:00",
        isNextWeekEnd: i === 0, // Пример смены на следующей неделе
        client: mockClients[((i + 1) % mockClients.length + mockClients.length) % mockClients.length]
      });
    }
  }
  
  return shifts;
};

export let storageShifts = generateMockShifts();
