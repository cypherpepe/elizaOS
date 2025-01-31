import { AxiosError } from "axios";

export const prepareAxiosErrorMessage = (error: AxiosError) => {
    return JSON.stringify(
        {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            code: error.code,
        },
        null,
        2
    );
};
