import { Authenticate } from "@/lib/api-auth";
import { handleErrors, HttpError, parseId } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { generateRequestNumber } from "@/lib/workflow";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

const MAX_NUMBER_RETRY = 5;

// POST /api/request/:id/submit
export async function POST(req: NextRequest, { params }: Ctx) {
  const auth = await Authenticate(req);
  if (auth.error) return auth.error;

  try {
    const id = parseId((await params).id);
    const userId = auth.user.sub;

    for (let index = 0; index < MAX_NUMBER_RETRY; index++) {
      try {
        const submitted = await prisma.$transaction(async (tx) => {
          const request = await tx.request.findUnique({ where: { id } });
          if (!request) throw new HttpError(404, "Request tidak ditemukan");
          if (request.requesterId !== userId)
            throw new HttpError(403, "Forbidden");
          if (request.status !== "Draft")
            throw new HttpError(409, "Request sudah ada");
          const requestNumber = await generateRequestNumber(tx);

          const updated = await tx.request.updateMany({
            where: { id, status: "Draft", version: request.version },
            data: {
              status: "WaitingApproval",
              requestNumber,
              version: { increment: 1 },
            },
          });
          if (updated.count === 0)
            throw new HttpError(
              409,
              "Request sudah berubah, mohon muat ulang dan coba lagi",
            );

          await tx.requestHistory.create({
            data: {
              requestId: id,
              stageId: request.currentStageId,
              actionId: null,
              actorId: userId,
              comment: "Request diajukan",
            },
          });

          return { id, requestNumber, status: "WaitingApproval" };
        });

        return NextResponse.json({ request: submitted });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new HttpError(
      503,
      "Gagal generate nomor request, silahkan coba lagi",
    );
  } catch (error) {
    return handleErrors(error);
  }
}
