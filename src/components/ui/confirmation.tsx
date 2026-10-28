import { useState } from 'react';
import { create } from 'zustand';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from './AlertDialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './Dialog';
import { Button } from './Button';
import { Input } from './Input';
import { Label } from './Label';

type Request = { message: string } & (
  | { kind: 'confirm'; resolve: (value: boolean) => void }
  | { kind: 'prompt'; defaultValue: string; resolve: (value: string | null) => void }
);
const useRequests = create<{ queue: Request[] }>(() => ({ queue: [] }));
const enqueue = (request: Request) => useRequests.setState(({ queue }) => ({ queue: [...queue, request] }));

export function confirmAction(message: string): Promise<boolean> {
  return new Promise((resolve) => enqueue({ kind: 'confirm', message, resolve }));
}

export function promptAction(message: string, defaultValue = ''): Promise<string | null> {
  return new Promise((resolve) => enqueue({ kind: 'prompt', message, defaultValue, resolve }));
}

function finish(request: Request, value: boolean | string | null) {
  if (useRequests.getState().queue[0] !== request) return;
  useRequests.setState(({ queue }) => ({ queue: queue.slice(1) }));
  if (request.kind === 'confirm') request.resolve(value === true);
  else request.resolve(typeof value === 'string' ? value : null);
}

function PromptRequest({ request }: { request: Extract<Request, { kind: 'prompt' }> }) {
  const [value, setValue] = useState(request.defaultValue);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) finish(request, null); }}>
      <DialogContent className="z-[141]" overlayClassName="z-[140]">
        <form onSubmit={(event) => { event.preventDefault(); finish(request, value); }} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{request.message}</DialogTitle>
            <DialogDescription>确认后保存，取消不会修改原有内容。</DialogDescription>
          </DialogHeader>
          <Label htmlFor="action-prompt">名称</Label>
          <Input id="action-prompt" value={value} onChange={(event) => setValue(event.target.value)} autoFocus />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => finish(request, null)}>取消</Button>
            <Button type="submit" variant="default" disabled={!value.trim()}>保存</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// One host queues business confirmations; focus and dismissal belong to Radix.
export function ConfirmationHost() {
  const request = useRequests((state) => state.queue[0]);
  if (!request) return null;
  if (request.kind === 'prompt') return <PromptRequest key={request.defaultValue + request.message} request={request} />;
  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) finish(request, false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认操作</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">{request.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish(request, false)}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={() => finish(request, true)}>确认</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
