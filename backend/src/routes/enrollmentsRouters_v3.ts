import { Router, type Request, type Response } from "express";
import { zEnrollmentBody } from "../libs/zodValidators.ts";
import { z } from "zod";

import type { CustomRequest } from "../libs/types.ts";

// import authentication middleware
import { authenticateToken } from "../middlewares/authenMiddleware.ts";
import { checkRoles } from "../middlewares/checkRolesDBMiddleware.ts";

// import database
import { PrismaClient } from "../../generated/prisma/client.ts";
const prisma = new PrismaClient();

const router = Router();

// สร้าง schema สำหรับ PUT
const zEnrollmentPutBody = z.object({
  studentId: z.string(),
  courseId: z.string(),
  newCourseId: z.string(),
});

// GET /api/v3/enrollments
router.get(
  "/",
  authenticateToken,
  checkRoles,
  async (req: CustomRequest, res: Response) => {
    try {
      const user = req.user;
      const enrollments = await prisma.enrollment.findMany({
        where:
          user?.role === "STUDENT" ? { studentId: user.studentId ?? "" } : {},
        orderBy: { createdAt: "asc" },
      });

      return res.json({
        success: true,
        data: enrollments,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Something is wrong, please try again",
        error: err,
      });
    }
  },
);

// POST /api/v3/enrollments
router.post(
  "/",
  authenticateToken,
  checkRoles,
  async (req: CustomRequest, res: Response) => {
    try {
      const result = zEnrollmentBody.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: result.error.issues[0]?.message,
        });
      }
      const { studentId, courseId } = result.data;

      const user = req.user;
      if (user?.role === "STUDENT" && studentId !== user.studentId) {
        return res.status(403).json({
          success: false,
          message: "Forbidden access",
        });
      }

      const student = await prisma.student.findUnique({
        where: { studentId },
      });
      if (!student) {
        return res.status(404).json({
          success: false,
          message: `Student ${studentId} does not exists`,
        });
      }
      const course = await prisma.course.findUnique({ where: { courseId } });
      if (!course) {
        return res.status(404).json({
          success: false,
          message: `Course ${courseId} does not exists`,
        });
      }

      const enrolled = await prisma.enrollment.findFirst({
        where: { studentId, courseId },
      });
      if (enrolled) {
        return res.status(409).json({
          success: false,
          message: `Student ${studentId} has already enrolled in ${courseId}`,
        });
      }

      const created = await prisma.enrollment.create({
        data: { studentId, courseId },
      });

      return res.status(201).json({
        success: true,
        data: created,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Something is wrong, please try again",
        error: err,
      });
    }
  },
);

// PUT /api/v3/enrollments (3.1 เปลี่ยนวิชา)
router.put(
  "/",
  authenticateToken,
  checkRoles,
  async (req: CustomRequest, res: Response) => {
    try {
      const result = zEnrollmentPutBody.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Bad Request",
          errors: result.error.issues,
        });
      }

      const { studentId, courseId, newCourseId } = result.data;
      const user = req.user;

      if (user?.role === "STUDENT" && user.studentId !== studentId) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      if (courseId === newCourseId) {
        return res.status(400).json({ success: false, message: "Bad Request" });
      }

      const currentEnrollment = await prisma.enrollment.findFirst({
        where: { studentId, courseId },
      });
      if (!currentEnrollment) {
        return res.status(404).json({ success: false, message: "Not Found" });
      }

      const newCourse = await prisma.course.findUnique({
        where: { courseId: newCourseId },
      });
      if (!newCourse) {
        return res.status(404).json({ success: false, message: "Not Found" });
      }

      const alreadyEnrolled = await prisma.enrollment.findFirst({
        where: { studentId, courseId: newCourseId },
      });
      if (alreadyEnrolled) {
        return res.status(409).json({ success: false, message: "Conflict" });
      }

      const updated = await prisma.enrollment.update({
        where: { id: currentEnrollment.id },
        data: { courseId: newCourseId },
      });

      return res.status(200).json({
        success: true,
        message: "Updated successfully",
        data: updated,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Server Error",
        error: err,
      });
    }
  },
);

// DELETE /api/v3/enrollments (3.2 ยกเลิกการลงทะเบียน)
router.delete(
  "/",
  authenticateToken,
  checkRoles,
  async (req: CustomRequest, res: Response) => {
    try {
      const result = zEnrollmentBody.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Bad Request",
          errors: result.error.issues,
        });
      }

      const { studentId, courseId } = result.data;
      const user = req.user;

      if (user?.role === "STUDENT" && user.studentId !== studentId) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      const enrollment = await prisma.enrollment.findFirst({
        where: { studentId, courseId },
      });

      if (!enrollment) {
        return res.status(404).json({ success: false, message: "Not Found" });
      }

      const deleted = await prisma.enrollment.delete({
        where: { id: enrollment.id },
      });

      return res.status(200).json({
        success: true,
        message: "Deleted successfully",
        data: deleted,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Server Error",
        error: err,
      });
    }
  },
);

export default router;