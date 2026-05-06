'use client'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface ImagePreviewDialogProps {
  open: boolean
  imageUrl?: string
  fileName?: string
  onOpenChange: (open: boolean) => void
}

export function ImagePreviewDialog({
  open,
  imageUrl,
  fileName,
  onOpenChange,
}: ImagePreviewDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="!max-w-5xl max-h-[90vh] flex flex-col">
        <AlertDialogHeader>
          <AlertDialogTitle>图片预览</AlertDialogTitle>
          <AlertDialogDescription className="break-all">
            {fileName || '附件图片'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="overflow-auto rounded border bg-muted/20 p-2">
          {imageUrl ? (
            <>
              {/* Runtime preview URLs cannot be optimized by next/image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={fileName || '附件图片'}
              className="mx-auto max-h-[65vh] w-auto object-contain"
            />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">暂无可预览图片</p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel type="button">关闭</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
