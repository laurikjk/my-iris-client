import {test} from "@playwright/test"
import {signUp} from "./auth.setup"

test("user can sign up with a name", async ({page}) => {
  await signUp(page)
})
