import {
	ApplicationError,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';
import { Client as YoutubeiClient, VideoCaptions, Caption } from 'youtubei';

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

				const youtubei = new YoutubeiClient();
				const videoInfo = await youtubei.getVideo(youtubeId);

				if (!videoInfo) {
					throw new NodeOperationError(this.getNode(), 'Failed to retrieve video information', {
						itemIndex,
					});
				}

				let text = '';
				if (videoInfo.captions) {
					try {
						let captions: Caption[] | undefined = await videoInfo.captions.get('ko');
						if (!captions || captions.length === 0) {
							captions = await videoInfo.captions.get('en');
						}

						if (captions && captions.length > 0) {
							text = captions.map((caption) => caption.text).join(' ');
						}
					} catch (captionError) {
						console.error(`Failed to extract transcript using youtubei: ${captionError.message}`);
						// 자막 추출에 실패해도 다른 정보는 계속 진행하도록 오류를 던지지 않음
					}
				}

				const output: { [key: string]: any } = {
					youtubeId: youtubeId,
				};

				if (text) {
					output.transcript = text.trim();
				}

				if (returnChannelId) output.channelId = videoInfo.channel?.id;
				if (returnChannelName) output.channelName = videoInfo.channel?.name;
				if (returnTitle) output.title = videoInfo.title;

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
