import { useState } from "react";
import { PlusCircle, ArrowRightLeft, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuthStore } from "@/lib/auth-store";
import { useEnrollmentStore } from "@/lib/enrollment-store";

export default function StudentEnrollmentsPage() {
  const studentId = useAuthStore((s) => s.studentId);
  const { students, courses, enrollments, enroll, updateEnrollment, dropEnrollment } = useEnrollmentStore();

  const [open, setOpen] = useState(false);
  const [formCourse, setFormCourse] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [changingCourseId, setChangingCourseId] = useState<string | null>(null);
  const [formNewCourse, setFormNewCourse] = useState<string | null>(null);
  const [changeError, setChangeError] = useState<string | null>(null);
  const [isChanging, setIsChanging] = useState(false);

  const [dropError, setDropError] = useState<string | null>(null);

  const me = students.find((s) => s.studentId === studentId);
  const myEnrollments = enrollments.filter((e) => e.studentId === studentId);

  const courseOptions = courses
    .filter((c) => !myEnrollments.some((e) => e.courseId === c.courseId))
    .map((c) => ({
      value: c.courseId,
      label: `${c.courseId} — ${c.courseTitle}`,
    }));

  const courseOf = (courseId: string) =>
    courses.find((c) => c.courseId === courseId);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setFormCourse(null);
      setServerError(null);
    }
  };

  const handleEnroll = async () => {
    if (!studentId || !formCourse) return;
    setSubmitting(true);
    setServerError(null);
    try {
      await enroll(studentId, formCourse);
      handleOpenChange(false);
    } catch (err) {
      setServerError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeOpen = (courseId: string | null) => {
    setChangingCourseId(courseId);
    setFormNewCourse(null);
    setChangeError(null);
  };

  const handleUpdateEnrollment = async (oldCourseId: string) => {
    if (!studentId || !formNewCourse) return;
    setIsChanging(true);
    setChangeError(null);
    try {
      await updateEnrollment(studentId, oldCourseId, formNewCourse);
      handleChangeOpen(null);
    } catch (err) {
      setChangeError((err as Error).message);
    } finally {
      setIsChanging(false);
    }
  };

  const handleDrop = async (courseId: string) => {
    if (!studentId) return;
    setDropError(null);
    try {
      await dropEnrollment(studentId, courseId);
    } catch (err) {
      setDropError(`ลบไม่สำเร็จ: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">จัดการการลงทะเบียน</h1>
          <p className="text-sm text-muted-foreground">
            {me
              ? `${me.studentId} — ${me.firstName} ${me.lastName} (${me.program})`
              : (studentId ?? "-")}{" "}
            · ลงทะเบียนแล้ว {myEnrollments.length} วิชา
          </p>
        </div>

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild={false}>
            <Button disabled={!studentId}>
              <PlusCircle className="h-4 w-4 mr-2" />
              ลงทะเบียนเรียน
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>ลงทะเบียนเรียน</DialogTitle>
              <DialogDescription>
                เลือกวิชาที่ยังไม่ได้ลงทะเบียน
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="formCourse">วิชา</Label>
              <Select
                value={formCourse ?? undefined}
                onValueChange={(v) => setFormCourse(v as string)}
              >
                <SelectTrigger id="formCourse" className="w-full">
                  <SelectValue
                    placeholder={
                      courseOptions.length === 0
                        ? "ลงทะเบียนครบทุกวิชาแล้ว"
                        : "เลือกวิชา"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {courseOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {serverError && (
              <p className="text-sm text-destructive">{serverError}</p>
            )}
            <DialogFooter>
              <Button
                disabled={!formCourse || submitting}
                onClick={handleEnroll}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                {submitting ? "กำลังลงทะเบียน..." : "ลงทะเบียน"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {dropError && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
          {dropError}
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>รหัสวิชา</TableHead>
              <TableHead>ชื่อวิชา</TableHead>
              <TableHead>ผู้สอน</TableHead>
              <TableHead>วันที่ลงทะเบียน</TableHead>
              <TableHead className="w-[100px] text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {myEnrollments.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-20 text-center text-muted-foreground"
                >
                  ยังไม่ได้ลงทะเบียนวิชาใด
                </TableCell>
              </TableRow>
            )}
            {myEnrollments.map((e) => {
              const course = courseOf(e.courseId);
              return (
                <TableRow key={e.courseId}>
                  <TableCell>{e.courseId}</TableCell>
                  <TableCell>{course?.courseTitle ?? "-"}</TableCell>
                  <TableCell>{course?.instructors.join(", ") || "-"}</TableCell>
                  <TableCell>
                    {e.enrolledAt
                      ? new Date(e.enrolledAt).toLocaleString("th-TH")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <Dialog
                        open={changingCourseId === e.courseId}
                        onOpenChange={(isOpen) => handleChangeOpen(isOpen ? e.courseId : null)}
                      >
                        <DialogTrigger asChild={false}>
                          <Button variant="ghost" size="icon" title="เปลี่ยนวิชา">
                            <ArrowRightLeft className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-lg">
                          <DialogHeader>
                            <DialogTitle>เปลี่ยนวิชา {e.courseId}</DialogTitle>
                            <DialogDescription>
                              เลือกวิชาใหม่แทนวิชา {e.courseId} (เลือกได้เฉพาะวิชาที่ยังไม่ได้ลงทะเบียน)
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="grid gap-1.5 py-4">
                            <Label htmlFor="formNewCourse">วิชาใหม่</Label>
                            <Select
                              value={formNewCourse ?? undefined}
                              onValueChange={(v) => setFormNewCourse(v as string)}
                            >
                              <SelectTrigger id="formNewCourse" className="w-full">
                                <SelectValue placeholder="เลือกวิชา" />
                              </SelectTrigger>
                              <SelectContent>
                                {courseOptions.map((o) => (
                                  <SelectItem key={o.value} value={o.value}>
                                    {o.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          {changeError && (
                            <p className="text-sm text-destructive">{changeError}</p>
                          )}
                          
                          <DialogFooter>
                            <Button
                              disabled={!formNewCourse || isChanging}
                              onClick={() => handleUpdateEnrollment(e.courseId)}
                            >
                              <ArrowRightLeft className="h-4 w-4 mr-2" />
                              {isChanging ? "กำลังบันทึก..." : "บันทึก"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="ghost"
                        size="icon"
                        title="ยกเลิกการลงทะเบียน"
                        onClick={() => handleDrop(e.courseId)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}