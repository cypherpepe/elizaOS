            const { actions } = parseActionResponseFromText(response.trim());
            if (actions) {
                elizaLogger.debug("Parsed tweet actions:", actions);
                return actions;
            }
            elizaLogger.debug("generateTweetActions no valid response"); 