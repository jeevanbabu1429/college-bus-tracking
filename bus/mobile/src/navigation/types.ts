// Help & support and Delete account are reachable from every role, and each
// role runs its own stack, so these routes are mixed into all three param
// lists below rather than living in one of them. The screens are typed off
// SupportRoutes alone so none has to know which stack it was pushed onto.
export type SupportRoutes = {
  ReportProblem: undefined;
  MyComplaints: undefined;
  DeleteAccount: undefined;
};

export type AuthStackParamList = {
  Login: { role?: "admin" | "driver" | "student" } | undefined;
  Register: undefined;
};

export type AppStackParamList = SupportRoutes & {
  Main: undefined;
  AddCollege: undefined;
  EditCollege: { college: import("../api/colleges").College };
  EditAdmin: undefined;
  AddBuses: { collegeId: string };
  AddDrivers: { collegeId: string };
  AddStudents: { collegeId: string };
  ViewBuses: { collegeId: string };
  ViewDrivers: { collegeId: string };
  ViewStudents: { collegeId: string };
  AssignDriversToBus: { collegeId: string };
  AssignStudentsToBus: { collegeId: string };
  BusDetail: { collegeId: string; busId: string };
  SetBusRoute: {
    collegeId: string;
    bus: import("../api/collegeBuses").Bus;
  };
  SelectDriverForBus: {
    collegeId: string;
    busId: string;
    busNumber: string;
    plateNumber: string;
    currentDriverId: string | null;
  };
  SelectStudentsForBus: {
    collegeId: string;
    busId: string;
    busNumber: string;
    plateNumber: string;
    capacity: number;
    route: string;
    stops: import("../api/collegeBuses").BusStop[];
  };
  EditDriver: { collegeId: string; driver: import("../api/collegeDrivers").Driver };
  EditStudent: { collegeId: string; student: import("../api/collegeStudents").Student };
};

export type DriverStackParamList = SupportRoutes & {
  DriverDashboard: undefined;
};

export type StudentStackParamList = SupportRoutes & {
  StudentDashboard: undefined;
  TrackOtherBuses: undefined;
  NearbyBuses: undefined;
  TrackOtherBusMap: { busId: string; busNumber: string };
};
