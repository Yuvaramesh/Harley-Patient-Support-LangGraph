// app/api/patient/profile/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { getCollection } from "@/lib/mongodb";

interface MedicationHistory {
  name: string;
  dosage: string;
  startDate?: string;
  endDate?: string;
  currentlyTaking: boolean;
  sideEffects?: string[];
}

interface OrderDetails {
  orderId: number;
  product: string;
  productPlan: string;
  dosage: string;
  orderDate: string;
  orderState: string;
}

interface PatientProfileData {
  email: string;
  name: string;
  contact: string;
  age?: string;
  ethnicity?: string;
  sex?: string;
  height?: number;
  weight?: number;
  bmi?: number;
  goalWeight?: number;
  weightLossHistory?: string;
  diabetes?: string;
  medicalConditions?: string[];
  otherConditions?: string;
  medications?: MedicationHistory[];
  allergies?: string[];
  gpNotification?: boolean;
  gpEmail?: string;
  orderHistory?: OrderDetails[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, contact, detailedProfile } = body;

    if (!email || !name || !contact) {
      return NextResponse.json(
        { error: "Missing required fields: email, name, contact" },
        { status: 400 }
      );
    }

    const patientId = email.replace(/[^a-zA-Z0-9]/g, "");
    const patientsCollection = await getCollection("patients");

    // Base profile data
    const profileData: any = {
      email,
      name,
      contact,
      updatedAt: new Date(),
    };

    // If detailed profile is provided, add comprehensive medical data
    if (detailedProfile) {
      // Parse questionnaire data
      const mainQuiz = detailedProfile.main_quiz;
      const orderQuiz = detailedProfile.order_quiz;
      const orderHistory = detailedProfile.order_history;

      if (mainQuiz?.answers) {
        // Extract age
        const ageAnswer = mainQuiz.answers.find(
          (a: any) => a.question_id === 1
        );
        if (ageAnswer) {
          profileData.age = ageAnswer.answer_text;
        }

        // Extract ethnicity
        const ethnicityAnswer = mainQuiz.answers.find(
          (a: any) => a.question_id === 2
        );
        if (ethnicityAnswer) {
          profileData.ethnicity = ethnicityAnswer.answer_text;
        }

        // Extract sex
        const sexAnswer = mainQuiz.answers.find(
          (a: any) => a.question_id === 3
        );
        if (sexAnswer) {
          profileData.sex = sexAnswer.answer_text;
        }

        // Extract weight loss duration
        const weightLossAnswer = mainQuiz.answers.find(
          (a: any) => a.question_id === 5
        );
        if (weightLossAnswer) {
          profileData.weightLossDuration = weightLossAnswer.answer_text;
        }

        // Extract height, weight, BMI
        const physicalAnswer = mainQuiz.answers.find(
          (a: any) => a.question_id === 6
        );
        if (physicalAnswer) {
          try {
            const physicalData = JSON.parse(physicalAnswer.answer_text);
            profileData.height = parseFloat(physicalData.height_cm);
            profileData.weight = parseFloat(physicalData.weight_kg);
            profileData.bmi = parseFloat(physicalData.bmi);
          } catch (e) {
            console.error("Error parsing physical data:", e);
          }
        }

        // Extract goal weight
        const goalWeightAnswer = mainQuiz.answers.find(
          (a: any) => a.question_id === 7
        );
        if (goalWeightAnswer) {
          try {
            const goalData = JSON.parse(goalWeightAnswer.answer_text);
            profileData.goalWeight = parseFloat(goalData.weight_kg);
          } catch (e) {
            console.error("Error parsing goal weight:", e);
          }
        }

        // Extract weight loss approaches
        const approachesAnswer = mainQuiz.answers.find(
          (a: any) => a.question_id === 8
        );
        if (approachesAnswer) {
          profileData.weightLossApproaches = approachesAnswer.answer_text;
        }

        // Extract diabetes information
        const diabetesAnswer = mainQuiz.answers.find(
          (a: any) => a.question_id === 9
        );
        if (diabetesAnswer) {
          profileData.diabetesStatus = diabetesAnswer.answer_text;
        }

        // Extract medical conditions
        const conditionsAnswers = mainQuiz.answers.filter(
          (a: any) => a.question_id === 11 || a.question_id === 12
        );
        profileData.medicalConditions = conditionsAnswers
          .map((a: any) => a.answer_text)
          .filter(
            (text: string) => text !== "None of these statements apply to me"
          );

        // Extract other conditions
        const otherConditionsAnswer = mainQuiz.answers.find(
          (a: any) => a.question_id === 14
        );
        if (otherConditionsAnswer) {
          profileData.otherMedicalConditions =
            otherConditionsAnswer.answer_text;
        }

        // Extract medication history
        const medications: MedicationHistory[] = [];

        // Wegovy
        const wegoyvAnswers = mainQuiz.answers.filter((a: any) =>
          a.question_title?.includes("Wegovy")
        );
        if (wegoyvAnswers.length > 0) {
          const wegoyvData: any = {
            name: "Wegovy",
            currentlyTaking: false,
          };

          wegoyvAnswers.forEach((answer: any) => {
            if (answer.question_id === 17) {
              try {
                const weightData = JSON.parse(answer.answer_text);
                wegoyvData.startingWeight = parseFloat(weightData.weight_kg);
              } catch (e) {}
            } else if (answer.question_id === 18) {
              wegoyvData.currentlyTaking = answer.answer_text === "Yes";
            } else if (answer.question_id === 21) {
              wegoyvData.lastDoseDate = answer.answer_text;
            }
          });

          medications.push(wegoyvData);
        }

        // Saxenda
        const saxendaAnswers = mainQuiz.answers.filter((a: any) =>
          a.question_title?.includes("Saxenda")
        );
        if (saxendaAnswers.length > 0) {
          const saxendaData: any = {
            name: "Saxenda",
            currentlyTaking: false,
          };

          saxendaAnswers.forEach((answer: any) => {
            if (answer.question_id === 31) {
              try {
                const weightData = JSON.parse(answer.answer_text);
                saxendaData.startingWeight = parseFloat(weightData.weight_kg);
              } catch (e) {}
            } else if (answer.question_id === 32) {
              saxendaData.currentlyTaking = answer.answer_text === "Yes";
            } else if (answer.question_id === 35) {
              saxendaData.lastDoseDate = answer.answer_text;
            }
          });

          medications.push(saxendaData);
        }

        // Mounjaro
        const mounjaroAnswers = mainQuiz.answers.filter((a: any) =>
          a.question_title?.includes("Mounjaro")
        );
        if (mounjaroAnswers.length > 0) {
          const mounjaroData: any = {
            name: "Mounjaro",
            currentlyTaking: false,
          };

          mounjaroAnswers.forEach((answer: any) => {
            if (answer.question_id === 45) {
              try {
                const weightData = JSON.parse(answer.answer_text);
                mounjaroData.startingWeight = parseFloat(weightData.weight_kg);
              } catch (e) {}
            } else if (answer.question_id === 46) {
              mounjaroData.currentlyTaking = answer.answer_text === "Yes";
            } else if (answer.question_id === 49) {
              mounjaroData.lastDoseDate = answer.answer_text;
            }
          });

          medications.push(mounjaroData);
        }

        profileData.medicationHistory = medications;

        // Extract current medications
        const currentMedsAnswer = mainQuiz.answers.find(
          (a: any) => a.question_id === 63
        );
        if (currentMedsAnswer) {
          profileData.currentMedications = currentMedsAnswer.answer_text;
        }

        // Extract allergies
        const allergiesAnswer = mainQuiz.answers.find(
          (a: any) => a.question_id === 65
        );
        if (allergiesAnswer) {
          profileData.allergies =
            allergiesAnswer.answer_text === "No"
              ? []
              : [allergiesAnswer.answer_text];
        }

        // Extract GP notification preference
        const gpNotificationAnswer = mainQuiz.answers.find(
          (a: any) => a.question_id === 67
        );
        if (gpNotificationAnswer) {
          profileData.gpNotification =
            gpNotificationAnswer.answer_text === "Yes";
        }
      }

      // Extract current order quiz data
      if (orderQuiz?.answers) {
        profileData.currentOrderInfo = {
          feelingRating: orderQuiz.answers.find(
            (a: any) => a.question_id === 71
          )?.answer_text,
          sideEffects: orderQuiz.answers.find((a: any) => a.question_id === 72)
            ?.answer_text,
          sideEffectsDetails: orderQuiz.answers.find(
            (a: any) => a.question_id === 73
          )?.answer_text,
          severityRating: orderQuiz.answers.find(
            (a: any) => a.question_id === 74
          )?.answer_text,
          takingAsPrescribed: orderQuiz.answers.find(
            (a: any) => a.question_id === 75
          )?.answer_text,
          medicationChanges: orderQuiz.answers.find(
            (a: any) => a.question_id === 76
          )?.answer_text,
        };

        // Current weight
        const currentWeightAnswer = orderQuiz.answers.find(
          (a: any) => a.question_id === 77
        );
        if (currentWeightAnswer) {
          try {
            const weightData = JSON.parse(currentWeightAnswer.answer_text);
            profileData.currentWeight = parseFloat(weightData.weight_kg);
          } catch (e) {}
        }
      }

      // Extract order history
      if (orderHistory?.orders) {
        profileData.orderHistory = orderHistory.orders.map((order: any) => ({
          orderId: order.order_id,
          product: order.product,
          productPlan: order.product_plan,
          dosage: order.dosage,
          orderDate: order.order_created_at,
          orderState: order.order_state,
        }));
        profileData.totalOrders = orderHistory.total_orders;
      }
    }

    // Create or update patient profile
    const result = await patientsCollection.updateOne(
      { email },
      {
        $set: profileData,
        $setOnInsert: {
          createdAt: new Date(),
          patientId,
        },
      },
      { upsert: true }
    );

    console.log(
      "[API] Patient profile saved with comprehensive medical data:",
      {
        email,
        hasDetailedProfile: !!detailedProfile,
        medicationCount: profileData.medicationHistory?.length || 0,
        orderCount: profileData.orderHistory?.length || 0,
      }
    );

    return NextResponse.json({
      success: true,
      message: "Patient profile saved with comprehensive medical information",
      data: { email, name, contact, patientId, profileData },
    });
  } catch (error) {
    console.error("Error saving patient profile:", error);
    return NextResponse.json(
      { error: "Failed to save patient profile" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const patientsCollection = await getCollection("patients");
    const patient = await patientsCollection.findOne({ email });

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: patient,
    });
  } catch (error) {
    console.error("Error fetching patient profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch patient profile" },
      { status: 500 }
    );
  }
}
