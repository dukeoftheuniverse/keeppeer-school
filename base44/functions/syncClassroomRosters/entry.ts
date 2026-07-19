import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('google_classroom');
    const headers = { Authorization: `Bearer ${accessToken}` };
    const API = 'https://classroom.googleapis.com/v1';

    if (action === 'listCourses') {
      const res = await fetch(`${API}/courses?courseStates=ACTIVE&pageSize=100`, { headers });
      if (!res.ok) return Response.json({ error: await res.text() }, { status: 502 });
      const data = await res.json();
      const courses = (data.courses || []).map(c => ({
        id: c.id, name: c.name, section: c.section || '', descriptionHeading: c.descriptionHeading || '', ownerId: c.ownerId || ''
      }));
      return Response.json({ courses });
    }

    if (action === 'listStudents') {
      const { courseId } = body;
      if (!courseId) return Response.json({ error: 'courseId required' }, { status: 400 });
      const res = await fetch(`${API}/courses/${courseId}/students?pageSize=1000`, { headers });
      if (!res.ok) return Response.json({ error: await res.text() }, { status: 502 });
      const data = await res.json();
      const students = (data.students || []).map(s => ({
        userId: s.userId, fullName: s.profile?.name?.fullName || '', emailAddress: s.profile?.emailAddress || ''
      })).filter(s => s.fullName);
      return Response.json({ students });
    }

    if (action === 'sync') {
      const { courseId, classId } = body;
      if (!courseId || !classId) return Response.json({ error: 'courseId and classId required' }, { status: 400 });
      const cls = await base44.asServiceRole.entities.Class.get(classId);

      const res = await fetch(`${API}/courses/${courseId}/students?pageSize=1000`, { headers });
      if (!res.ok) return Response.json({ error: await res.text() }, { status: 502 });
      const data = await res.json();
      const gcStudents = (data.students || []).map(s => ({
        classroomEmail: s.profile?.emailAddress || '',
        fullName: s.profile?.name?.fullName || ''
      })).filter(s => s.fullName);

      const existing = await base44.asServiceRole.entities.Student.filter({ grade: cls.grade_level, section: cls.section });
      const byEmail = new Map();
      const byName = new Map();
      existing.forEach(s => {
        if (s.classroom_email) byEmail.set(s.classroom_email.toLowerCase(), s);
        byName.set(`${s.first_name} ${s.last_name}`.toLowerCase().trim(), s);
      });

      const enrollments = await base44.asServiceRole.entities.Enrollment.filter({ class_id: classId });
      const enrolledIds = new Set(enrollments.map(e => e.student_id));
      const ay = await base44.asServiceRole.entities.AcademicYear.filter({ is_current: true });
      const ayId = ay[0]?.id || '';
      const ayName = ay[0]?.name || cls.academic_year || '';
      const today = new Date().toISOString().slice(0, 10);

      const matchedStudents = [];
      const toCreate = [];
      let matched = 0;
      gcStudents.forEach(gs => {
        let stu = byEmail.get((gs.classroomEmail || '').toLowerCase());
        if (!stu) {
          const parts = gs.fullName.trim().split(/\s+/);
          const first = parts[0] || gs.fullName;
          const last = parts.length > 1 ? parts[parts.length - 1] : '';
          stu = byName.get(`${first} ${last}`.toLowerCase().trim());
        }
        if (stu) { matched++; matchedStudents.push(stu); }
        else {
          const parts = gs.fullName.trim().split(/\s+/);
          toCreate.push({
            first_name: parts[0] || gs.fullName,
            last_name: parts.length > 1 ? parts[parts.length - 1] : '',
            grade: cls.grade_level,
            section: cls.section,
            enrollment_status: 'enrolled',
            classroom_email: gs.classroomEmail || ''
          });
        }
      });

      let createdStudents = [];
      if (toCreate.length) createdStudents = await base44.asServiceRole.entities.Student.bulkCreate(toCreate);
      const created = createdStudents.length;

      const toEnroll = [];
      [...matchedStudents, ...createdStudents].forEach(s => {
        if (!enrolledIds.has(s.id)) {
          toEnroll.push({
            student_id: s.id,
            student_name: `${s.first_name} ${s.last_name}`,
            class_id: classId,
            class_name: `${cls.grade_level} - ${cls.section}`,
            academic_year_id: ayId,
            academic_year_name: ayName,
            enrollment_date: today,
            status: 'enrolled'
          });
        }
      });
      if (toEnroll.length) await base44.asServiceRole.entities.Enrollment.bulkCreate(toEnroll);

      const newCount = enrollments.length + toEnroll.length;
      await base44.asServiceRole.entities.Class.update(classId, { enrolled_count: newCount });

      return Response.json({
        total: gcStudents.length, matched, created, enrolled: toEnroll.length,
        classEnrolledCount: newCount
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});