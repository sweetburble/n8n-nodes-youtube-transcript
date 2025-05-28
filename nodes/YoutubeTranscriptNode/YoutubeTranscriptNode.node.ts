import {
	ApplicationError,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import { YoutubeTranscript } from 'youtube-transcript';
import { Client as YoutubeiClient } from 'youtubei';

export class YoutubeTranscriptNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Youtube Transcript',
		name: 'youtubeTranscriptNode',
		// eslint-disable-next-line n8n-nodes-base/node-class-description-icon-not-svg
		icon: 'file:youTube.png',
		group: ['transform'],
		version: 1,
		description: 'Get Transcript of a youtube video',
		defaults: {
			name: 'Youtube Transcript',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName: 'Youtube Video ID or Url',
				name: 'youtubeId',
				type: 'string',
				default: '',
				placeholder: 'Youtube Video ID or Url',
			},
			{
				displayName: 'Return Channel ID',
				name: 'returnChannelId',
				type: 'boolean',
				default: false,
			},
			{
				displayName: 'Return Channel Name',
				name: 'returnChannelName',
				type: 'boolean',
				default: false,
			},
			{
				displayName: 'Return Title',
				name: 'returnTitle',
				type: 'boolean',
				default: false,
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const getTranscriptFromYoutube = async function (youtubeId: string) {
			try {
				const url = `https://www.youtube.com/watch?v=${youtubeId}`;
				const transcript = await YoutubeTranscript.fetchTranscript(url);

				return transcript;
			} catch (error) {
				// Log the error but don't throw, allow to proceed to get other info
				console.error(`Failed to extract transcript: ${error.message}`);
				return null; // Return null if transcript fetching fails
			}
		};

		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				const youtubeIdOrUrl = this.getNodeParameter('youtubeId', itemIndex, '') as string;
				const returnChannelId = this.getNodeParameter(
					'returnChannelId',
					itemIndex,
					false,
				) as boolean;
				const returnChannelName = this.getNodeParameter(
					'returnChannelName',
					itemIndex,
					false,
				) as boolean;
				const returnTitle = this.getNodeParameter('returnTitle', itemIndex, false) as boolean;

				let youtubeId = youtubeIdOrUrl;
				const urlRegex = /^(http(s)?:\/\/)?((w){3}.)?youtu(be|.be)?(\.com)?\/.+/;

				if (urlRegex.test(youtubeId)) {
					const url = new URL(youtubeId);

					if (url.hostname === 'youtu.be') {
						youtubeId = url.pathname.slice(1); // Extract the video ID from the path
					} else {
						const v = url.searchParams.get('v');
						if (!v) {
							throw new ApplicationError(
								`The provided URL doesn't contain a valid YouTube video identifier. URL: ${youtubeId}`,
							);
						}
						youtubeId = v;
					}
				}

				const transcriptData = await getTranscriptFromYoutube(youtubeId);

				let text = '';
				if (transcriptData && Array.isArray(transcriptData)) {
					for (const line of transcriptData) {
						if (line && typeof line.text === 'string') {
							text += line.text + ' ';
						}
					}
				}

				const output: { [key: string]: any } = {
					youtubeId: youtubeId,
				};

				if (text) {
					output.transcript = text.trim();
				}

				if (returnChannelId || returnChannelName || returnTitle) {
					const youtubei = new YoutubeiClient();
					const videoInfo = await youtubei.getVideo(youtubeId);
					if (!videoInfo) {
						throw new NodeOperationError(this.getNode(), 'Failed to retrieve video information', {
							itemIndex,
						});
					}
					if (returnChannelId) output.channelId = videoInfo.channel?.id;
					if (returnChannelName) output.channelName = videoInfo.channel?.name;
					if (returnTitle) output.title = videoInfo.title;
				}

				returnData.push({
					json: output,
					pairedItem: { item: itemIndex },
				});
			} catch (error) {
				if (this.continueOnFail()) {
					items.push({ json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex });
				} else {
					if (error.context) {
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return [returnData];
	}
}
