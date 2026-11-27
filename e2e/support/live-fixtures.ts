import { createRequire } from "node:module";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

export const backend = resolve(process.env.E2E_BACKEND_DIR ?? "KinVue_Server");
const authRequire = createRequire(
  resolve(backend, "services/auth/package.json"),
);
const usersRequire = createRequire(
  resolve(backend, "services/user/package.json"),
);
const movieRequire = createRequire(
  resolve(backend, "services/movie/package.json"),
);

export function grantFixtureAdmin(userId: string) {
  const result = spawnSync(
    process.execPath,
    [
      resolve(backend, "services/auth/scripts/grant-admin.mjs"),
      "--user-id",
      userId,
    ],
    {
      env: {
        ...process.env,
        AUTH_DATABASE_URL: process.env.E2E_AUTH_DATABASE_URL,
      },
      encoding: "utf8",
      windowsHide: true,
    },
  );
  if (result.status !== 0)
    throw new Error("Disposable fixture admin grant failed");
}

// Test setup/teardown only. All product actions in the journey go through Gateway/Rooms.
export async function cleanFixtures(
  userIds: string[],
  movieIds: string[],
  sessions: string[],
) {
  if (process.env.E2E_DISPOSABLE_STACK !== "1")
    throw new Error("Cleanup requires an explicitly disposable stack");
  if (
    [...userIds, ...movieIds, ...sessions].some(
      (id) => !/^[0-9a-f-]{36}$/i.test(id),
    )
  )
    throw new Error("Invalid fixture identifiers");
  const { Pool } = authRequire("pg");
  const { MongoClient } = usersRequire("mongodb");
  const auth = new Pool({
    connectionString: process.env.E2E_AUTH_DATABASE_URL,
  });
  const movie = new Pool({
    connectionString: process.env.E2E_MOVIE_DATABASE_URL,
  });
  const mongo = new MongoClient(process.env.E2E_USERS_MONGO_URL!);
  try {
    await mongo.connect();
    const db = mongo.db("kinvue_users");
    await db.collection("friendships").deleteMany({
      $or: [{ user1Id: { $in: userIds } }, { user2Id: { $in: userIds } }],
    });
    await db
      .collection("outbox_events")
      .deleteMany({ recipientId: { $in: userIds } });
    await db.collection("users").deleteMany({ _id: { $in: userIds } });
    await movie.query(
      "DELETE FROM watchlist_items WHERE user_id = ANY($1::uuid[])",
      [userIds],
    );
    await movie.query(
      "DELETE FROM movie_outbox_events WHERE payload->>'movieId' = ANY($1::text[])",
      [movieIds],
    );
    await movie.query(
      "DELETE FROM movie_uploads WHERE movie_id = ANY($1::uuid[])",
      [movieIds],
    );
    await movie.query(
      "DELETE FROM movies WHERE movie_id = ANY($1::uuid[]) AND created_by_user_id = ANY($2::uuid[])",
      [movieIds, userIds],
    );
    await auth.query(
      "DELETE FROM refresh_sessions WHERE user_id = ANY($1::uuid[])",
      [userIds],
    );
    await auth.query(
      "DELETE FROM auth_outbox_events WHERE payload->>'userId' = ANY($1::text[])",
      [userIds],
    );
    await auth.query(
      'DELETE FROM "authUser" WHERE id::text = ANY($1::text[])',
      [userIds],
    );
    await auth.query(
      "DELETE FROM auth_identities WHERE user_id = ANY($1::uuid[])",
      [userIds],
    );
    if (movieIds.length) {
      const { MeiliSearch } = movieRequire("meilisearch");
      const search = new MeiliSearch({
        host: process.env.E2E_MEILI_URL,
        apiKey: process.env.E2E_MEILI_KEY,
      });
      await search.index("movies").deleteDocuments(movieIds);
      const {
        S3Client,
        ListObjectsV2Command,
        DeleteObjectsCommand,
        ListMultipartUploadsCommand,
        AbortMultipartUploadCommand,
      } = movieRequire("@aws-sdk/client-s3");
      const s3 = new S3Client({
        endpoint: process.env.E2E_S3_URL,
        region: "us-east-1",
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.E2E_S3_ACCESS_KEY!,
          secretAccessKey: process.env.E2E_S3_SECRET_KEY!,
        },
      });
      const Bucket = "kinvue-media";
      try {
        for (const prefix of [
          ...movieIds.map((id) => `movies/${id}/`),
          ...sessions.map((id) => `_access/${id}/`),
        ]) {
          let token: string | undefined;
          do {
            const page: {
              Contents?: { Key: string }[];
              NextContinuationToken?: string;
            } = await s3.send(
              new ListObjectsV2Command({
                Bucket,
                Prefix: prefix,
                ContinuationToken: token,
              }),
            );
            if (page.Contents?.length)
              await s3.send(
                new DeleteObjectsCommand({
                  Bucket,
                  Delete: {
                    Objects: page.Contents.map((object: { Key: string }) => ({
                      Key: object.Key,
                    })),
                  },
                }),
              );
            token = page.NextContinuationToken;
          } while (token);
          if (prefix.startsWith("movies/")) {
            const unfinished = await s3.send(
              new ListMultipartUploadsCommand({ Bucket, Prefix: prefix }),
            );
            for (const upload of unfinished.Uploads ?? [])
              await s3.send(
                new AbortMultipartUploadCommand({
                  Bucket,
                  Key: upload.Key,
                  UploadId: upload.UploadId,
                }),
              );
          }
        }
      } finally {
        s3.destroy();
      }
    }
    if (
      (
        await auth.query(
          "SELECT 1 FROM auth_identities WHERE user_id = ANY($1::uuid[])",
          [userIds],
        )
      ).rowCount
    )
      throw new Error("Fixture identities survived cleanup");
    if (
      (
        await movie.query(
          "SELECT 1 FROM movies WHERE movie_id = ANY($1::uuid[])",
          [movieIds],
        )
      ).rowCount
    )
      throw new Error("Fixture movies survived cleanup");
  } finally {
    await Promise.all([auth.end(), movie.end(), mongo.close()]);
  }
}
