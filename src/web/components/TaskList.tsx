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
import type { TaskResponse, ProjectResponse } from '../../types/index.js';

interface TaskListProps {
  tasks: TaskResponse[];
  projects: ProjectResponse[];
  onReorder: (taskIds: number[]) => void;
  onSelectTask: (task: TaskResponse) => void;
  onComplete: (id: number) => void;
  onSnooze: (id: number, duration: string) => void;
  onDelete: (id: number) => void;
  onSnoozeNotification: (id: number, duration: string) => void;
  onClearNotification: (id: number) => void;
}

export default function TaskList({
  tasks,
  projects,
  onReorder,
  onSelectTask,
  onComplete,
  onSnooze,
  onDelete,
  onSnoozeNotification,
  onClearNotification,
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

  // Get project for a task
  const getProject = (projectId: number | null): ProjectResponse | null => {
    if (!projectId) return null;
    return projects.find((p) => p.id === projectId) ?? null;
  };

  if (tasks.length === 0) {
    return <div className="text-center py-12 text-slate-500">No tasks found. Add one above!</div>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              project={getProject(task.projectId)}
              onSelect={onSelectTask}
              onComplete={onComplete}
              onSnooze={onSnooze}
              onDelete={onDelete}
              onSnoozeNotification={onSnoozeNotification}
              onClearNotification={onClearNotification}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
