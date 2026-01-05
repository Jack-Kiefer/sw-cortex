import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useState } from 'react';
import TaskItem from './TaskItem';

interface Task {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  projectId: number | null;
  dueDate: string | null;
  tags: string | null;
  createdAt: string;
  completedAt: string | null;
  snoozedUntil: string | null;
}

interface TaskListProps {
  tasks: Task[];
  onReorder: (taskIds: number[]) => void;
  onComplete: (id: number) => void;
  onSnooze: (id: number, duration: string) => void;
  onDelete: (id: number) => void;
}

export default function TaskList({
  tasks,
  onReorder,
  onComplete,
  onSnooze,
  onDelete,
}: TaskListProps) {
  const [items, setItems] = useState(tasks);

  // Update items when tasks change
  if (JSON.stringify(tasks.map((t) => t.id)) !== JSON.stringify(items.map((t) => t.id))) {
    setItems(tasks);
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((t) => t.id === active.id);
      const newIndex = items.findIndex((t) => t.id === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);
      onReorder(newItems.map((t) => t.id));
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        No tasks found. Add one above!
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onComplete={onComplete}
              onSnooze={onSnooze}
              onDelete={onDelete}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
