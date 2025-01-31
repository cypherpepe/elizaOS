import { AxiosInstance, AxiosError } from "axios";
import { UserInfo } from "../interfaces";
import { prepareAxiosErrorMessage } from "../helpers/prepare-axios-error-message";

export class LinkedInUserInfoFetcher {
    constructor(private readonly axios: AxiosInstance) {}

    async getUserInfo() {
        try {
            const response = await this.axios.get<UserInfo>("/v2/userinfo");
            return response.data;
        } catch (error) {
            const isAxiosError = error instanceof AxiosError;

            throw new Error(
                `Failed to fetch user info: ${isAxiosError ? prepareAxiosErrorMessage(error) : error}`
            );
        }
    }
}
