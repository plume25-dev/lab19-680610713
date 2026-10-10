import { Router, type Request, type Response } from "express";
// นำเข้า zStudentPutBody เพิ่มเติมสำหรับตรวจ Validation ของ PUT
import { zStudentPostBody, zStudentId, zStudentPutBody } from "../libs/zodValidators.js";

import type { Student, CustomRequest } from "../libs/types.js";

// import authentication middleware
import { authenticateToken } from "../middlewares/authenMiddleware.ts";
import { checkRoleAdmin } from "../middlewares/checkRoleAdminDBMiddleware.ts";
import { checkRoles } from "../middlewares/checkRolesDBMiddleware.ts";

// import database
import { PrismaClient } from "../../generated/prisma/client.ts";
const prisma = new PrismaClient();

const router = Router();

// GET /api/v3/students
// get students (by program) with files
router.get(
  "/",
  authenticateToken,
  checkRoleAdmin,
  async (req: Request, res: Response) => {
    try {
      // get students from DB (with their files records)
      const students = await prisma.student.findMany({
        include: { files: true },
      });

      // get program name from query string (if any)
      const program = req.query.program;
      if (program) {
        // filter students by program
        let filtered_students = students.filter(
          (student: any) => student.program === program,
        );
        return res.json({
          success: true,
          data: filtered_students,
        });
      } else {
        // return all students
        return res.json({
          success: true,
          data: students,
        });
      }
    } catch (err) {
      return res.json({
        success: false,
        message: "Something is wrong, please try again",
        error: err,
      });
    }
  },
);

// GET /api/v3/students/{studentId}
router.get(
  "/:studentId",
  authenticateToken,
  checkRoles,
  async (req: CustomRequest, res: Response) => {
    try {
      // get user, token from CustomRequest (token payload)
      const user = req.user;
      const token = req.token;

      // get parameterized variable: studentId
      const studentId = req.params.studentId as string;
      // validate studentId
      const result = zStudentId.safeParse(studentId);
      if (!result.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: result.error.issues[0]?.message,
        });
      }

      let found_student = null;
      if (studentId) {
        // get student from DB by studentId
        found_student = await prisma.student.findUnique({
          where: { studentId: studentId },
        });
      }

      // if student is not found
      if (!found_student) {
        return res.status(404).json({
          success: false,
          message: "Student does not exists",
        });
      }

      // if STUDENT does not own the data
      if (
        user?.role === "STUDENT" &&
        found_student.studentId !== user.studentId
      ) {
        return res.status(403).json({
          success: false,
          message: "Forbidden access",
        });
      }

      res.json({
        success: true,
        data: found_student,
      });
    } catch (err) {
      return res.json({
        success: false,
        message: "Something is wrong, please try again",
        error: err,
      });
    }
  },
);

// POST /api/v3/students, body = {new student data}
// add a new student
router.post(
  "/",
  authenticateToken,
  checkRoleAdmin,
  async (req: CustomRequest, res: Response) => {
    try {
      // get new student info from req.body
      const body = (await req.body) as Student;

      // validate req.body with predefined validator
      const result = zStudentPostBody.safeParse(body); // check zod
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: result.error.issues[0]?.message,
        });
      }

      //check if the studentId exists in DB
      const student = await prisma.student.findUnique({
        where: { studentId: result.data.studentId },
      });
      if (student) {
        return res.status(400).json({
          success: false,
          message: "The StudentID is already taken.",
        });
      }

      // add new student and write to DB
      const { studentId, firstName, lastName, program, interests, emails } =
        result.data;
      const created = await prisma.student.create({
        data: {
          studentId,
          firstName,
          lastName,
          program,
          interests,
          emails,
        },
      });

      // add response header 'Link'
      res.set("Link", `/api/v3/students/${created.studentId}`);

      return res.status(201).json({
        success: true,
        data: created,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Somthing is wrong, please try again",
        error: err,
      });
    }
  },
);

// PUT /api/v3/students (1.1 แก้ไขข้อมูลนักศึกษา)
router.put(
  "/",
  authenticateToken,
  checkRoles, // ใช้ checkRoles เพื่อให้ทั้ง ADMIN และ STUDENT เข้าถึงได้ (แต่จะไปเช็คสิทธิ์ด้านในอีกที)
  async (req: CustomRequest, res: Response) => {
    try {
      // ตรวจสอบข้อมูลด้วย Zod
      const result = zStudentPutBody.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: "Bad Request",
          errors: result.error.issues,
        });
      }

      const { studentId, firstName, lastName, program, interests, emails } = result.data;
      const user = req.user;

      // Role STUDENT แก้ไขได้แค่ข้อมูลของตัวเองเท่านั้น
      if (user?.role === "STUDENT" && user.studentId !== studentId) {
        return res.status(403).json({
          success: false,
          message: "Forbidden",
        });
      }

      // ค้นหานักศึกษาในฐานข้อมูล
      const student = await prisma.student.findUnique({
        where: { studentId },
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Not Found",
        });
      }

      // สร้างอับเดต Object โดยกรองฟิลด์ที่ไม่เป็น undefined เพื่อแก้ปัญหา Type Error ของ Prisma
      const updateData: any = {};
      if (firstName !== undefined && firstName !== null) updateData.firstName = firstName;
      if (lastName !== undefined && lastName !== null) updateData.lastName = lastName;
      if (program !== undefined && program !== null) updateData.program = program;
      if (interests !== undefined && interests !== null) updateData.interests = interests;
      if (emails !== undefined && emails !== null) updateData.emails = emails;

      // อัปเดตข้อมูล
      const updated = await prisma.student.update({
        where: { studentId },
        data: updateData,
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
  }
);

// DELETE /api/v3/students (1.2 ลบนักศึกษา)
router.delete(
  "/",
  authenticateToken,
  checkRoleAdmin, // ใช้ได้เฉพาะ ADMIN
  async (req: Request, res: Response) => {
    try {
      const { studentId } = req.body;

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: "Bad Request",
        });
      }

      // ตรวจสอบว่ามีนักศึกษาอยู่หรือไม่
      const student = await prisma.student.findUnique({
        where: { studentId },
      });

      if (!student) {
        return res.status(404).json({
          success: false,
          message: "Not Found",
        });
      }

      // ต้องลบ Enrollment ที่อ้างอิง studentId ก่อน แล้วค่อยลบนักศึกษา (ทำเป็น Transaction)
      await prisma.$transaction([
        prisma.enrollment.deleteMany({
          where: { studentId },
        }),
        prisma.student.delete({
          where: { studentId },
        }),
      ]);

      return res.status(200).json({
        success: true,
        message: "Deleted successfully",
        data: student,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: "Server Error",
        error: err,
      });
    }
  }
);

export default router;