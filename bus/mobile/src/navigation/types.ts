export type AuthStackParamList = {
  Login: { role?: "admin" | "driver" | "student" } | undefined;
  Register: undefined;
  Payment: {
    name: string;
    gender: import("../api/auth").Gender;
    dob: string;
    mobile: string;
    email: string;
  };
};

export type AppStackParamList = {
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

export type DriverStackParamList = {
  DriverDashboard: undefined;
};

export type StudentStackParamList = {
  StudentDashboard: undefined;
  TrackOtherBuses: undefined;
  TrackOtherBusMap: { busId: string; busNumber: string };
};
