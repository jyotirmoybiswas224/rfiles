import PropTypes from "prop-types";
import React, { useEffect, useRef, useState, useCallback, useMemo, memo } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { BiPlus } from "react-icons/bi";
import Dropdown from "../../../../../../../../components/UI/dropdowns/Dropdown";
import CustomDatePicker from "../../../../../../../../components/UI/CustomDatePicker";
import Textarea from "../../../../../../../../components/UI/Textarea";
import MultiSelectRounded from "../../../../../../../../components/UI/dropdowns/MultiSelectRounded";
import GeneratorInfoHeader from "./components/GeneratorInfoHeader";
import {
	frequencyPrimaryOptions,
	frequencySecondaryOptions,
	generatorStatus,
	SERVICE_STATUS,
	SERVICE_TYPES,
	serviceDurationOptions,
	serviceTypes,
	subWasteType,
	weekdayOptions,
} from "../../../../../../../../utils/constants";
import {
	getAllGeneratorsLocationSnapshot,
	getAllRoutes,
	getAllTreatmentsLocationSnapshot,
	getAllVendorsLocationSnapshot,
	getGeneratorById,
} from "../../../../../../../../utils/firebaseOperations";
import {
	capitalizeFirstLetter,
	dateFormatter,
	daysOfWeek,
	formattedDate,
	getUpcomingDates,
	getUpcomingWeekdays,
	randomizeCoordinates,
	showErrorToastMessage,
	showInternalServerErrorToastMessage,
	showLoadingToastMessage,
	showSuccessToastMessage,
} from "../../../../../../../../utils/helpers";
import {
	arrayUnion,
	collection,
	deleteDoc,
	doc,
	getDoc,
	getDocs,
	limit,
	onSnapshot,
	orderBy,
	query,
	serverTimestamp,
	Timestamp,
	updateDoc,
	where,
	writeBatch,
} from "firebase/firestore";
import { addOrUpdateGeneratorScheduleReq } from "../../../../../../../../utils/apiOps";
import RouteAssignment from "./components/RouteAssignment";
// import MapWithRoutes from "../../../../../../../../components/maps/MapWithRoutes";
import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { auth, COLLECTIONS, db } from "../../../../../../../../config/firebase";
import Loader from "../../../../../../../../components/UI/loaders/Loader";
import { MdCheck, MdContentCopy } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import Button from "../../../../../../../../components/UI/Button";
import { useAuthState } from "react-firebase-hooks/auth";
import { log } from "handlebars";
import NoOfStops from "./NoOfStops";
import { AzureMapsProvider } from "react-azure-maps";
import useTUserContext from "../../../../../../../../context/TransporterUserContext";
import GeneratorManifests from "./GeneratorManifests";
import { HiOutlineChevronDown, HiOutlineChevronUp } from "react-icons/hi";
import SearchableDropdownForParents from "../../../../../../../../components/UI/dropdowns/SearchableDropdownForParents";
import GeneratorUpcomingServices from "./GeneratorUpcomingServices";
import GeneratorPreviousServices from "./GeneratorPreviousServices";
import SsrFormComponent from "./components/SSRFormComponent";
import { useSSRManagement } from "../../../../../../../../utils/useSsrRequests";
import MemoizedMapSection from "./components/MemoizedMapSection";
import Explainer from "../../../../../../../../components/UI/Explainer";
import { data } from "autoprefixer";

const defaultOption = {
	serviceType: "",
	routeId: "",
	serviceFrequency: {
		type: "",
		days: [],
	},
	anchorDate: null,
	updatedAt: null,
	expectedItemOrService: [],
	serviceDuration: "15",
	notes: "",
	deliveryNotes: "",
	isWillCall: false,
	isSetUpService: false,
	isUpdating: true,
};

const GeneratorRoutes = ({ onClickBack, genId, setGeneratorData, generatorData }) => {
	const {
		control,
		handleSubmit,
		formState: { errors },
		watch,
		setValue,
		getValues,
		reset,
		trigger,
	} = useForm({
		defaultValues: {
			serviceSchedules: [defaultOption],
			requestedStartDate: null,
		},
	});
	const {
		control: instructionControl,
		handleSubmit: instructionHandleSubmit,
		setValue: setInstructionsValue,
		watch: watchInstructions,
	} = useForm({
		defaultValues: {
			deliveryNote: "",
			parkingNote: "",
			locationOfWaste: "",
			lockBoxCode: "",
			serviceInstructions: "",
			octoConnectNote: "",
		},
	});

	const { fields, append, remove } = useFieldArray({
		control,
		name: "serviceSchedules",
	});
	const navigate = useNavigate();
	const [showSSRFrom, setShowSSRForm] = useState(false);
	const [prevInstructions, setPrevInstructions] = useState({});
	const [serviceTypeOptions, setServiceTypeOptions] = useState([]);
	const [routeOptions, setRouteOptions] = useState([]);
	const [allRoutesOptions, setAllRoutesOptions] = useState([]);
	const [isLoadingServices, setIsLoadingServices] = useState(true);
	const [generatorScheduledServices, setGeneratorScheduledServices] = useState([]);
	const [selectedRouteIds, setSelectedRouteIds] = useState([]);
	const [allRoutes, setAllRoutes] = useState([]);
	const [prevServiceSchedules, setPrevServiceSchedules] = useState([]);
	//const [updatedRoutesId, setUpdatedRoutesId] = useState([]);
	const [allGeneratorsData, setAllGeneratorsData] = useState([]);
	const [allTreatmentData, setAllTreatmentData] = useState([]);
	const [allVendorData, setAllVendorData] = useState([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [upcomingServices, setUpcomingServices] = useState([]);
	const [previousServices, setPreviousServices] = useState([]);
	const [copied, setCopied] = useState(false);
	//const [affectedServices, setAffectedServices] = useState(0);
	const formValues = watch();
	const { user, loading } = useTUserContext();
	const [delay, setDelay] = useState(0);
	const [isGeneratorProfileComplete, setIsGeneratorProfileComplete] = useState(true);
	const [transporterData, setTransporterData] = useState(null);
	const [octoMarketProfile, setOctoMarketProfile] = useState(null);
	const [disableButton, setDisableButton] = useState(false);
	const [itemsOptions, setItemsOptions] = useState([]);
	const [itemsMap, setItemsMap] = useState({});
	const [cancelReason, setCancelReason] = useState("");
	const [currentServiceSchedules, setCurrentServiceSchedules] = useState([]);
	const [currentSSRIndex, setCurrentSSRIndex] = useState(0);
	const [transporterName, setTransporterName] = useState("");
	const [KeepContainers, setKeepContainers] = useState(false);
	const [serviceFrequencyOptions, setServiceFrequencyOptions] = useState([
		...frequencyPrimaryOptions,
		...frequencySecondaryOptions,
	]);
	const [selectedSSR, setSelectedSSR] = useState({});
	const [terminationDate, setTerminationDate] = useState(null);
	const [terminationNote, setTerminationNote] = useState("");
	const [liveGeneratorData, setLiveGeneratorData] = useState(null);
	const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
	const [showAvailableSubCont, setShowAvailableSubCont] = useState(false);
	const [subContractors, setSubContractors] = useState([]);
	const [selectedSubAssignee, setSelectedSubAssignee] = useState("");
	const [toReassign, setToReassign] = useState(null);
	const [isReassigning, setIsReassigning] = useState(false);
	const [notifyAllUsers, setNotifyAllUsers] = useState(false);
	const [serviceSettingData, setServiceSettingData] = useState(null);

	useEffect(() => {
		if (!generatorData?.id) return;
		let unsubscribe = onSnapshot(doc(db, COLLECTIONS.generators, generatorData?.id), (doc) => {
			if (doc.exists()) {
				const data = { ...doc.data(), id: doc.id };
				setLiveGeneratorData(data);
			}
		});
		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [generatorData]);

	useEffect(() => {
		if (!liveGeneratorData) return;
		if (liveGeneratorData?.generatorStatus == "ADMINISTRATIVE_ACCOUNT") {
			document.getElementById(`generator_administrative_account`).showModal();
			return;
		}
		if (
			!liveGeneratorData?.serviceAddCoordinates ||
			!liveGeneratorData?.serviceAddCoordinates.lat ||
			!liveGeneratorData?.serviceAddCoordinates.lng
		) {
			setIsGeneratorProfileComplete(false);
		}

		if (
			liveGeneratorData?.generatorStatus == "PROSPECT" ||
			liveGeneratorData?.generatorStatus == "CANCELED" ||
			liveGeneratorData?.generatorStatus == "DEAD_FILE"
		) {
			document.getElementById(`generator_not_contracted`).showModal();
			return;
		}

		if (liveGeneratorData?.generatorStatus === "PARKING" || liveGeneratorData?.generatorStatus === "NIGO") {
			document.getElementById(`generator_marked_as_NIGO_or_parking`).showModal();
			return;
		}
		return () => {};
	}, [liveGeneratorData]);

	const fetchTransporter = async (transporterId) => {
		let snapRef = doc(db, COLLECTIONS.transporters, transporterId);
		let snapDoc = await getDoc(snapRef);
		let snapData = { id: snapDoc.id, ...snapDoc.data() };
		console.log({ snapData });
		setTransporterName(snapData?.companyDisplayName);
	};

	const updateGeneratorData = async () => {
		const data = await getGeneratorById(genId);
		setGeneratorData(data);
		setDisableButton(false);
	};

	useEffect(() => {
		if (user?.uid == generatorData?.transporterId && generatorData?.isSubContracted) {
			fetchTransporter(generatorData?.subContractors?.[0]?.id);
		}
	}, [user, generatorData]);

	const autoSaveInstructions = async (data) => {
		if (!generatorData || !user?.uid) return;

		const currentTransporterId = user?.uid;

		const hasRealChanges = Object.keys(data).some((key) => {
			return data[key] !== prevInstructions[key];
		});

		if (!hasRealChanges) return;

		try {
			// Create the update object with the proper path to the transporter's instructions
			const updateData = {};

			Object.keys(data).forEach((key) => {
				updateData[`transporterInstructions.${currentTransporterId}.${key}`] = data[key];
			});

			await updateDoc(doc(db, COLLECTIONS.generators, generatorData.id), updateData);
			const getGenerator = await getGeneratorById(generatorData.id);
			setGeneratorData(getGenerator);
			setPrevInstructions((prev) => ({ ...prev, ...data }));
			showSuccessToastMessage("Service Instructions saved automatically");
		} catch (error) {
			console.error("Error saving instructions:", error);
			showErrorToastMessage("Failed to save instructions");
		}
	};

	useEffect(() => {
		if (genId) updateGeneratorData();
	}, [genId]);

	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const section = urlParams.get("section");

		if (section) {
			const element = document.getElementById(section);
			if (element) {
				element.scrollIntoView({ behavior: "smooth" });
			}
		}
	}, [allGeneratorsData, isLoadingServices]);

	// In your component where you use the SSR functionality
	const {
		subContractorContainers,
		handleSubcontractorSelected,
		isOctoMarketUser,
		subContractorData,
		sentSubcontractorRequests,
		activeSentSSRs,
		cancelSubcontractorRequest,
		subcontractorServiveFrequencyOptions,
	} = useSSRManagement(user?.uid, generatorData?.id);

	useEffect(() => {
		if (!generatorData?.id) return;
		let unsubscribe = onSnapshot(
			query(collection(db, COLLECTIONS.serviceSchedules), where("generatorId", "==", generatorData?.id)),
			(snap) => {
				setCurrentServiceSchedules(snap.docs.map((el) => ({ ...el.data(), id: el.id })) ?? []);
			}
		);

		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [generatorData]);

	useEffect(() => {
		if (!user) return;
		let unsubscribe = onSnapshot(doc(db, COLLECTIONS.serviceSettings, user.uid), (doc) => {
			if (doc.exists()) {
				const data = doc.data();
				setServiceSettingData(data);
				if (data?.serviceFrequencies?.length > 0) {
					const tempFrequencyOptions = [];
					data?.serviceFrequencies?.forEach((item) => {
						const frequency = serviceFrequencyOptions.find((option) => option.value === item);
						if (frequency) {
							tempFrequencyOptions.push(frequency);
						}
					});
					setServiceFrequencyOptions(tempFrequencyOptions);
				}
			}
		});
		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [user]);
	useEffect(() => {
		if (!user || !user?.uid) return;
		let unsubscribe = onSnapshot(doc(db, COLLECTIONS.transporters, user?.uid), (snap) => {
			if (snap.exists()) {
				setTransporterData({ ...snap.data(), id: snap.id });
			}
		});

		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [user]);
	useEffect(() => {
		if (!user || !user?.uid) return;
		let unsubscribe = onSnapshot(doc(db, COLLECTIONS.octoMarketUsers, user?.uid), (snap) => {
			if (snap.exists()) {
				setOctoMarketProfile({ ...snap.data(), id: snap.id });
			}
		});
		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [user]);

	const fetchContainers = useCallback(async (transporterId) => {
		if (!transporterId) {
			console.log("No transporter ID provided");
			return [];
		}

		try {
			return new Promise((resolve, reject) => {
				const unsubscribe = onSnapshot(
					collection(db, "priceBooks", transporterId, "default", "services", "containers"),
					(snap) => {
						let tempOptions = [];
						let tempMap = {};

						if (snap.docs.length) {
							snap.docs.forEach((el) => {
								if (el.data()?.active) {
									tempOptions.push({
										label: el.data()?.masterItemName ?? "--",
										value: el.id,
										subWasteType: el.data()?.subWasteType,
									});
									tempMap[el.id] = el.data()?.masterItemName ?? "--";
								}
							});

							setItemsMap((prevMap) => ({ ...prevMap, ...tempMap }));
						} else {
							console.log(`No containers found for transporter: ${transporterId}`);
						}
						unsubscribe();
						resolve(tempOptions);
					},
					(error) => {
						console.error("Error fetching containers:", error);
						unsubscribe();
						reject(error);
					}
				);
			});
		} catch (error) {
			console.error("Error setting up container listener:", error);
			return [];
		}
	}, []);

	useEffect(() => {
		if (user?.uid) {
			const loadTransporterContainers = async () => {
				try {
					const containers = await fetchContainers(user.uid);
					setItemsOptions(containers);
				} catch (error) {
					console.error("Failed to load initial containers:", error);
				}
			};

			loadTransporterContainers();
		}
	}, [user?.uid]);

	useEffect(() => {
		if (!generatorData || !user?.uid) return;

		const currentTransporterId = user?.uid;
		const transporterInstructions = generatorData?.transporterInstructions?.[currentTransporterId];
		const emptyInstructions = {
			deliveryNote: "",
			locationOfWaste: "",
			lockBoxCode: "",
			parkingNote: "",
			serviceInstructions: "",
			octoConnectNote: "",
		};

		const instructions = transporterInstructions || emptyInstructions;

		setInstructionsValue("deliveryNote", instructions.deliveryNote);
		setInstructionsValue("locationOfWaste", instructions.locationOfWaste);
		setInstructionsValue("lockBoxCode", instructions.lockBoxCode);
		setInstructionsValue("parkingNote", instructions.parkingNote);
		setInstructionsValue("serviceInstructions", instructions.serviceInstructions);
		setInstructionsValue("octoConnectNote", instructions.octoConnectNote);

		setPrevInstructions({
			deliveryNote: instructions.deliveryNote,
			locationOfWaste: instructions.locationOfWaste,
			lockBoxCode: instructions.lockBoxCode,
			parkingNote: instructions.parkingNote,
			serviceInstructions: instructions.serviceInstructions,
			octoConnectNote: instructions.octoConnectNote,
		});
	}, [generatorData, user?.uid, setInstructionsValue]);

	useEffect(() => {
		if (!isGeneratorProfileComplete) {
			document.getElementById(`generator_address_not_found`).showModal();
		}
	}, [isGeneratorProfileComplete]);

	const fetchServiceSchedules = async () => {
		const snap = await getDocs(
			query(
				collection(db, COLLECTIONS.serviceSchedules),
				where("generatorId", "==", generatorData.id),
				where("transporterId", "==", user?.uid)
			)
		);
		const tempSchedules = snap.docs
			.filter((el) => el.exists())
			.map((el) => {
				const data = { ...el.data(), id: el.id };

				if (typeof data.serviceType !== "string") {
					data.serviceType = data.serviceType[0];
				}
				if (!data.hasOwnProperty("isDeleted") || data.isDeleted === false) {
					delete data.upcomingDates;
					const sourceDate = data.updatedAt || data.createdAt;

					if (sourceDate) {
						if (sourceDate.toDate && typeof sourceDate.toDate === "function") {
							data.establishedDate = sourceDate.toDate();
						} else if (sourceDate.seconds !== undefined) {
							data.establishedDate = new Date(sourceDate.seconds * 1000);
						} else if (sourceDate instanceof Date) {
							data.establishedDate = sourceDate;
						} else if (typeof sourceDate === "string") {
							data.establishedDate = new Date(sourceDate);
						}
					}

					return data;
				}
				return null;
			})
			.filter(Boolean);

		tempSchedules.sort((a, b) => {
			const getDateValue = (item) => {
				if (!item?.createdAt) return new Date(0);

				try {
					if (item.createdAt.toDate && typeof item.createdAt.toDate === "function") {
						return item.createdAt.toDate();
					}
					if (item.createdAt.seconds !== undefined) {
						return new Date(item.createdAt.seconds * 1000);
					}
					if (item.createdAt instanceof Date) {
						return item.createdAt;
					}
					return new Date(item.createdAt);
				} catch (e) {
					return new Date(0);
				}
			};

			return getDateValue(a) - getDateValue(b);
		});
		setValue("serviceSchedules", tempSchedules);
		setPrevServiceSchedules(tempSchedules);
	};
	useEffect(() => {
		if (!generatorData) return;
		fetchServiceSchedules();
	}, [generatorData]);

	useEffect(() => {
		if (!generatorData) return;

		let unsubscribe = onSnapshot(
			query(
				collection(db, COLLECTIONS.scheduledServices),
				where("generatorId", "==", generatorData.id),
				where("status", "!=", SERVICE_STATUS.DELETED),
				orderBy("date", "asc"),
				limit(100)
			),
			async (snap) => {
				try {
					setIsLoadingServices(true);

					let tempServices = [];
					const jobs = snap.docs.map(async (el) => {
						if (el.exists()) {
							const data = { ...el.data(), id: el.id };
							if (data?.routeId?.length > 0) {
								const routeRes = await getDoc(doc(db, COLLECTIONS.routes, data.routeId));
								if (routeRes.exists()) {
									data.routeData = { ...routeRes.data(), id: routeRes.id };
								}
							}
							if (data?.serviceScheduleId?.length > 0) {
								const serviceScheduleRes = await getDoc(doc(db, COLLECTIONS.serviceSchedules, data.serviceScheduleId));
								if (serviceScheduleRes.exists()) {
									data.serviceScheduleData = { ...serviceScheduleRes.data(), id: serviceScheduleRes.id };
								}
							}
							tempServices.push(data);
						}
					});
					await Promise.all(jobs);

					console.log({ tempServices });
					const today = new Date();
					const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0));
					setUpcomingServices(
						tempServices
							.filter((el) => {
								if (
									el.date.toDate() >= todayUTC &&
									el.status !== SERVICE_STATUS.COMPLETE &&
									el.status !== SERVICE_STATUS.CLOSED
								) {
									return true;
								} else {
									return false;
								}
							})
							.sort((a, b) => a.date.toDate() - b.date.toDate())
					);
					setPreviousServices([
						...tempServices
							.filter(
								(el) =>
									el.date.toDate() < todayUTC ||
									el.status === SERVICE_STATUS.COMPLETE ||
									el.status === SERVICE_STATUS.CLOSED
							)
							.sort((a, b) => b.date.toDate() - a.date.toDate()),
					]);

					setGeneratorScheduledServices(tempServices);
					setIsLoadingServices(false);
				} catch (error) {
					console.log(error);
				}
			}
		);

		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [generatorData]);

	useEffect(() => {
		const getAllOtherRoutes = async () => {
			const snap = await getDocs(query(collection(db, COLLECTIONS.routes), where("transporterId", "==", user?.uid)));
			setAllRoutes([...snap.docs.map((el) => ({ ...el.data(), id: el.id }))]);
		};
		if (user && user?.uid) getAllOtherRoutes();
	}, [user]);

	useEffect(() => {
		if (!user || !user?.uid) return;
		if (!generatorData) return;
		let unsubscribe = onSnapshot(
			query(collection(db, COLLECTIONS.generators), where("transporterId", "==", user?.uid)),
			(snap) => {
				const tempGeneratorData = [];
				snap.docs.forEach((generator) => {
					if (
						generator.exists() &&
						generator.data().serviceAddCoordinates &&
						generator.data().serviceAddCoordinates.lat &&
						generator.data().serviceAddCoordinates.lng
					) {
						tempGeneratorData.push({
							...generator.data(),
							id: generator.id,
							randomCoordinates: randomizeCoordinates(
								generator.data().serviceAddCoordinates.lat,
								generator.data().serviceAddCoordinates.lng
							),
						});
					}
				});
				const alreadyExist = tempGeneratorData.find((el) => el.id === generatorData?.id);

				if (!alreadyExist) {
					tempGeneratorData.push({
						...generatorData,
						id: generatorData.id,
						randomCoordinates: randomizeCoordinates(
							generatorData.serviceAddCoordinates.lat,
							generatorData.serviceAddCoordinates.lng
						),
					});
				}
				setAllGeneratorsData(tempGeneratorData);
			}
		);
		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [user, generatorData]);
	useEffect(() => {
		if (!user || !user?.uid) return;
		let unsubscribe = getAllTreatmentsLocationSnapshot(setAllTreatmentData, user?.uid);
		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [user]);
	useEffect(() => {
		if (!user || !user?.uid) return;
		let unsubscribe = getAllVendorsLocationSnapshot(setAllVendorData, user?.uid);
		return () => {
			if (unsubscribe) unsubscribe();
		};
	}, [user]);

	const watchServiceSchedules = watch("serviceSchedules");

	useEffect(() => {
		const fetchAllRoutesOptions = async () => {
			try {
				let resp = await getAllRoutes(user?.uid);
				console.log({ resp });

				const allActiveRoutes = resp.filter((route) => route.status === "ACTIVE");
				const allOtherRoutes = resp.filter((route) => route.status !== "ACTIVE");

				setAllRoutesOptions(resp);
				let options = [];
				options.push({ label: "Available Routes", value: null, isDisabled: true });
				allActiveRoutes.forEach((item) => {
					options.push({
						label: item.routeLabel,
						value: item.id,
					});
				});
				options.push({ label: "Out of Service Network", value: null, isDisabled: true });
				allOtherRoutes.forEach((item) => {
					options.push({
						label: item.routeLabel,
						value: item.id,
					});
				});

				setRouteOptions(options);
			} catch (error) {
				console.log("Error fetching routes", error);
			}
		};
		if (user) fetchAllRoutesOptions();
	}, [user]);

	useEffect(() => {
		if (generatorData?.serviceType) {
			setServiceTypeOptions(serviceTypes.filter((item) => generatorData?.serviceType.includes(item.value)));
		}
	}, [generatorData]);

	useEffect(() => {
		if (watchServiceSchedules) {
			watchServiceSchedules.forEach((schedule, index) => {
				const calculatedDates = calculateUpcomingDates(schedule);
				setValue(`serviceSchedules.${index}.upcomingDates`, calculatedDates, { shouldValidate: true });
			});
		}
	}, [watchServiceSchedules, setValue]);
	useEffect(() => {
		const subscription = watch((value, { name }) => {
			if (
				name &&
				name.startsWith("serviceSchedules") &&
				(name.endsWith("anchorDate") || name.includes("serviceFrequency"))
			) {
				const index = parseInt(name.split(".")[1]);
				const schedule = value.serviceSchedules[index];

				if (schedule && schedule?.anchorDate && schedule?.serviceFrequency && schedule?.routeId) {
					console.log("Calculating dates for schedule:", schedule);
					let calculatedDates = [];
					if (schedule.serviceFrequency.type === "WC") {
						calculatedDates = [];
					} else if (schedule.serviceFrequency.type === "MTWM") {
						if (schedule.serviceFrequency.days.length > 0) {
							const anchorDate = new Date(schedule.anchorDate);
							const anchorDateUTC = new Date(
								Date.UTC(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate())
							);

							calculatedDates = getUpcomingWeekdays(anchorDateUTC, schedule.serviceFrequency.days, 6);
						}
					} else {
						calculatedDates = getUpcomingDates(new Date(schedule.anchorDate), schedule.serviceFrequency.type, 6);
					}
					let dates = calculatedDates;
					setValue(`serviceSchedules.${index}.upcomingDates`, dates);
				}
			}
		});

		return () => subscription.unsubscribe();
	}, [watch, setValue]);

	const groupContainersBySubWasteType = (containers) => {
		const groupedContainers = {};

		containers.forEach((container) => {
			const subWasteType = container.subWasteType;
			if (!groupedContainers[subWasteType]) {
				groupedContainers[subWasteType] = [];
			}
			groupedContainers[subWasteType].push(container);
		});

		// Then create a new array with headers and options
		const result = [];

		Object.keys(groupedContainers)
			.sort()
			.forEach((subWasteType) => {
				// Add a header for this subWasteType group
				result.push({
					label: `${subWasteType}`,
					value: subWasteType,
					isDisabled: true,
					isHeader: true,
				});

				// Add all containers for this group
				groupedContainers[subWasteType].forEach((container) => {
					result.push({
						label: container.label,
						value: container.value,
					});
				});
			});

		return result;
	};

	function formatUtcDateString(utcDateString) {
		const date = new Date(utcDateString);
		const formatter = new Intl.DateTimeFormat("en-US", {
			weekday: "short",
			month: "2-digit",
			day: "2-digit",
			year: "numeric",
			timeZone: "UTC",
		});

		return formatter.format(date);
	}

	function formatDateString(utcDateString, timeZone = "America/Los_Angeles") {
		const date = new Date(utcDateString);
		const formatter = new Intl.DateTimeFormat("en-US", {
			weekday: "short",
			month: "2-digit",
			day: "2-digit",
			year: "numeric",
			timeZone,
		});

		return formatter.format(date);
	}
	function formatTimeString(dateString, timeZone = "America/Los_Angeles") {
		const date = new Date(dateString);

		const formatter = new Intl.DateTimeFormat("en-US", {
			hour12: true,
			hour: "2-digit",
			minute: "2-digit",
			timeZone,
		});

		return formatter.format(date);
	}

	const addSetUpService = () => {
		append({
			...defaultOption,
			isSetUpService: true,
			doNotifyAllUsers: false,
		});
		setNotifyAllUsers(false);
	};

	const handleSave = async (index) => {
		try {
			setIsSubmitting(true);
			const data = {
				...formValues.serviceSchedules[index],
				generatorId: generatorData.id,
				transporterId: user?.uid,
				contractorId: generatorData?.transporterId,
				subcontractorId: user?.uid,
				createdAt: serverTimestamp(),
				doNotifyStakeholders: notifyAllUsers,
			};
			console.log("Data to save:", data);
			delete data?.isUpdating;
			delete data?.isSetUpService;
			delete data?.upcomingDates;
			showLoadingToastMessage("Saving...");
			let scheduleRef = null;
			if (data?.id) {
				scheduleRef = doc(db, COLLECTIONS.serviceSchedules, data.id);
			} else {
				scheduleRef = doc(collection(db, COLLECTIONS.serviceSchedules));
			}

			const batch = writeBatch(db);
			batch.set(scheduleRef, data);
			if (!data?.id) {
				batch.update(doc(db, COLLECTIONS.generators, generatorData.id), {
					serviceSchedules: arrayUnion(scheduleRef.id),
					updatedAt: serverTimestamp(),
				});
			}
			await batch.commit();
			if (notifyAllUsers) {
				showSuccessToastMessage(
					"Service created successfully! All the stakeholders will not be notified. Changes will reflect shortly."
				);
			} else {
				showSuccessToastMessage(
					"Service created successfully! All the stakeholders will be notified. Changes will reflect shortly."
				);
			}
			updateGeneratorData();
			fetchServiceSchedules();
		} catch (error) {
			if (error.cause === "customError") {
				showErrorToastMessage(error.message);
			} else {
				toast.dismiss();
				console.error("Error saving schedules:", error);
				toast.error("Error saving schedules. Please try again.");
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	const deleteSchedule = async (field, index) => {
		console.log({ field });
		showLoadingToastMessage("Deleting");
		let allSchedules = getValues("serviceSchedules");

		let dataToDelete = allSchedules.find((_, i) => index == i);
		console.log({ dataToDelete });

		let theData = {
			...field,
			id: dataToDelete.id,
		};

		if (theData.id) {
			try {
				const serviceRes = await getDocs(
					query(
						collection(db, COLLECTIONS.scheduledServices),
						where("generatorId", "==", generatorData.id),
						where("serviceScheduleId", "==", formValues.serviceSchedules[index].id),
						where("status", "==", SERVICE_STATUS.PENDING)
					)
				);
				let batch = writeBatch(db);
				let count = 0;
				for (const el of serviceRes.docs) {
					batch.delete(el.ref);
					count++;
					if (count >= 450) {
						await batch.commit();
						count = 0;
						batch = writeBatch(db);
					}
				}
				batch.update(doc(db, COLLECTIONS.serviceSchedules, theData.id), { isDeleted: true });
				await batch.commit();
				showSuccessToastMessage("Deleted successfully!");
				updateGeneratorData();
				fetchServiceSchedules();
			} catch (error) {
				console.error("Failed to delete schedule:", error);
			}
		} else {
			showSuccessToastMessage("Deleted successfully!");
			remove(index);
		}
	};

	const instructionSubmitHandler = async (data) => {
		if (!generatorData || !user?.uid) return;
		const currentTransporterId = user?.uid;

		try {
			showLoadingToastMessage("Saving Service Instructions.");
			const updateData = {
				[`transporterInstructions.${currentTransporterId}`]: data,
			};

			await updateDoc(doc(db, COLLECTIONS.generators, generatorData.id), updateData);
			const getGenerator = await getGeneratorById(generatorData.id);
			setGeneratorData(getGenerator);
			setPrevInstructions(data);
			showSuccessToastMessage("Service Instructions saved successfully.");
		} catch (error) {
			console.log(error);
			showInternalServerErrorToastMessage();
		}
	};

	const handleCopyToClipboard = async () => {
		try {
			let dates = upcomingServices.map((scheduledService) => formattedDate(scheduledService.date));
			await navigator.clipboard.writeText(dates?.join("; "));
			setCopied(true);
			setTimeout(() => {
				setCopied(false);
			}, 1000);
		} catch (err) {
			console.error("Failed to copy:", err);
		}
	};
	const serviceNoteRef = useRef(null);

	useEffect(() => {
		if (generatorData?.transporterId != user.uid) return;
		const textarea = serviceNoteRef.current;
		if (!textarea) return;
		let cursorPosition = 0;
		let wasFocused = false;

		const handleFocus = () => {
			wasFocused = true;
		};

		const handleBlur = () => {
			wasFocused = false;
		};

		const handleInput = () => {
			cursorPosition = textarea.selectionStart;
		};

		const handleRender = () => {
			if (wasFocused) {
				textarea.focus();
				textarea.setSelectionRange(cursorPosition, cursorPosition);
			}
		};

		textarea.addEventListener("focus", handleFocus);
		textarea.addEventListener("blur", handleBlur);
		textarea.addEventListener("input", handleInput);

		const observer = new MutationObserver(handleRender);
		observer.observe(textarea.parentNode, {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
		});

		return () => {
			textarea.removeEventListener("focus", handleFocus);
			textarea.removeEventListener("blur", handleBlur);
			textarea.removeEventListener("input", handleInput);
			observer.disconnect();
		};
	}, [generatorData?.transporterId]);
	// 	const formRef = useRef(null);

	// useEffect(() => {
	//   const handleClickOutside = (event) => {
	//     if (formRef.current && !formRef.current.contains(event.target)) {
	//       setShowSSRForm(false);
	//     }
	//   };

	//   if (showSSRFrom) {
	//     document.addEventListener("mousedown", handleClickOutside);
	//   }

	//   return () => {
	//     document.removeEventListener("mousedown", handleClickOutside);
	//   };
	// }, [showSSRFrom]);

	const SsrActionButtons = memo(
		({ isReadOnly, onCancel, onSubmit, currentSSRIndex, setCurrentSSRIndex, sentSubcontractorRequests }) => {
			const currentSsr = sentSubcontractorRequests[currentSSRIndex];

			return (
				<div className="w-full flex justify-end p-2 gap-4">
					{!isReadOnly && (
						<>
							<button
								type="button"
								className="rounded-full px-4 py-2 text-sm border border-gray-500 hover:bg-gray-100 transition"
								onClick={onCancel}
							>
								Cancel
							</button>
							<button
								type="button"
								className="rounded-full px-4 py-2 text-sm bg-primary-500 hover:bg-primary-500/90 text-white transition"
								onClick={onSubmit}
							>
								Send To Subcontractor
							</button>
						</>
					)}
					{isReadOnly &&
						sentSubcontractorRequests[currentSSRIndex]?.subcontractorId !== user?.uid &&
						sentSubcontractorRequests[currentSSRIndex]?.status !== "TERMINATEACCEPTED" &&
						sentSubcontractorRequests[currentSSRIndex]?.status !== "TERMINATED" && (
							<>
								<button
									type="button"
									className={`rounded-full px-4 py-2 text-sm border border-gray-500 hover:bg-gray-100 transition ${
										currentSsr?.status == "TERMINATEACCEPTED"
											? "bg-primary text-white rounded-full px-4 py-1 ml-2 hover:bg-primary/90"
											: ""
									}`}
									onClick={() => {
										setCurrentSSRIndex(currentSSRIndex);
										setSelectedSSR(currentSsr);
										document.getElementById(`delete-SSR`).showModal();
									}}
									disabled={currentSsr?.status == "TERMINATED"}
								>
									{currentSsr?.status == SERVICE_STATUS.ACCEPTED ? "Termination Request Form" : "Cancel"}
								</button>
								{currentSsr?.status === SERVICE_STATUS.PENDING && (
									<button
										type="button"
										className="bg-primary text-white rounded-full px-4 py-1 ml-2 hover:bg-primary/90"
										onClick={() => {
											setToReassign(currentSsr);
											setIsReassignModalOpen(true);
											setShowAvailableSubCont(false);
										}}
									>
										Reassign
									</button>
								)}
							</>
						)}
				</div>
			);
		}
	);
	SsrActionButtons.displayName = "SsrActionButtons";

	const renderSSRButton = () => {
		let isDisable = false;
		// if (cotoMarketProfile && cotoMarketProfile?.connections && Object.keys(cotoMarketProfile?.connections).length) {
		// 	Object.keys(cotoMarketProfile?.connections).forEach((key) => {
		// 		if (cotoMarketProfile?.connections[key].status === "accepted") {
		// 			isDisable = false;
		// 		}
		// 	});
		// }
		return (
			<button
				type="button"
				className={`text-cardTextGray border-borderCol flex items-center justify-between gap-1 min-w-40 px-8 py-3 rounded-full ${
					isDisable
						? "bg-dashBtnGradient brightness-75 text-gray-200"
						: "bg-dashBtnGradient text-white hover:opacity-90"
				} border transition-colors duration-200 ease-in-out`}
				onClick={() => {
					setShowSSRForm(!showSSRFrom);
					if (!isOctoMarketUser) {
						document.getElementById(`transporter_not_octomarket_user`).showModal();
					}

					if (isDisable) {
						showErrorToastMessage("You don't have any active connection to create SSR");
						return;
					}
				}}
			>
				<span className="pr-5">Subcontractor Service Request (SSR)</span>
				<BiPlus size={16} />
			</button>
		);
	};
	const renderAddMoreServiceButtons = () => {
		return (
			<div className="text-sm flex gap-5 items-center">
				<button
					type="button"
					className={`text-cardTextGray border-borderCol flex items-center justify-between gap-1 min-w-40 px-8 py-3 rounded-full bg-creamWhite hover:bg-cardTextGray hover:bg-opacity-10 border transition-colors duration-200 ease-in-out`}
					onClick={addSetUpService}
				>
					<span className="pr-5">Add a Service</span>
					<BiPlus size={16} />
				</button>
			</div>
		);
	};

	const renderOperatingHours = (date = new Date()) => {
		const dayNo = date.getDay();
		const dayName = daysOfWeek[dayNo];
		if (!generatorData) return "N/A";
		const operatingHours = generatorData?.workingHours?.[dayName];

		if (operatingHours?.closed) {
			return "Closed";
		}
		if (operatingHours?.open && operatingHours?.close) {
			return `${operatingHours.open} ${
				operatingHours?.lunchStart?.length ? `: ${operatingHours?.lunchStart}` : ""
			} -  ${operatingHours?.lunchEnd?.length ? `${operatingHours?.lunchStart} :` : ""} ${operatingHours.close}`;
		} else {
			return "N/A";
		}
	};
	const renderUpcomingOperatingHours = (date) => {
		if (typeof date === "string") {
			date = new Date(date);
		} else {
			console.log("String Not Found");
			return <p>N/A</p>; // Return early if date is not valid
		}

		const currentDate = new Date(date);
		const dateUTC = new Date(date);
		const dayNo = dateUTC.getDay();
		const dayName = daysOfWeek[dayNo];

		if (!generatorData || !generatorData.workingHours || !generatorData.workingHours[dayName]) {
			return <p>N/A</p>;
		}

		const operatingHours = generatorData?.workingHours?.[dayName] ?? null;

		if (operatingHours?.closed) {
			return <p className="text-red-500">Closed</p>;
		}

		if (operatingHours?.open && operatingHours?.close) {
			if (operatingHours?.lunchStart?.length && operatingHours?.lunchEnd?.length) {
				return (
					<>
						<p>
							{operatingHours.open} - {operatingHours?.lunchStart}
						</p>
						<p>
							{operatingHours?.lunchEnd} - {operatingHours.close}
						</p>
					</>
				);
			} else {
				return (
					<>
						<p>
							{operatingHours.open} - {operatingHours.close}
						</p>
					</>
				);
			}
		} else {
			return <p>N/A</p>;
		}
	};

	const isUpdating = (prev, form) => {
		let isUpdating = false;
		if (!prev) {
			isUpdating = false;
		}
		if (!form) {
			isUpdating = false;
		}
		const prevData = prev ? { ...prev } : {};
		if (prevData.expectedItemOrService?.length > 0) {
			prevData.expectedItemOrService = prevData.expectedItemOrService.map((el) => ({
				item: el.item,
				quantity: el.quantity,
			}));
		}

		delete prev?.upcomingDates;
		const formData = form ? { ...form } : {};
		delete formData?.upcomingDates;
		if (formData.expectedItemOrService?.length > 0) {
			formData.expectedItemOrService = formData.expectedItemOrService.map((el) => ({
				item: el.item,
				quantity: el.quantity,
			}));
		}
		if (JSON.stringify(prevData) !== JSON.stringify(formData)) {
			isUpdating = true;
		} else {
			isUpdating = false;
		}

		return isUpdating;
	};
	const isUpdatingInstruction = () => {
		const form = watchInstructions();
		if (
			form.deliveryNote !== prevInstructions.deliveryNote ||
			form.locationOfWaste !== prevInstructions.locationOfWaste ||
			form.lockBoxCode !== prevInstructions.lockBoxCode ||
			form.parkingNote !== prevInstructions.parkingNote ||
			form.serviceInstructions !== prevInstructions.serviceInstructions ||
			form.octoConnectNote !== prevInstructions.octoConnectNote
		) {
			return true;
		} else {
			return false;
		}
	};

	const handleCancelCurrentSSR = () => {
		console.log("Cancel reason:", cancelReason);
		if (sentSubcontractorRequests[currentSSRIndex]?.status === SERVICE_STATUS.ACCEPTED) {
			console.log("termination date", terminationDate);

			cancelSubcontractorRequest(
				sentSubcontractorRequests[currentSSRIndex],
				cancelReason,
				terminationDate,
				terminationNote,
				generatorData?.generatorName
			).then((success) => {
				if (success) {
					document.getElementById(`delete-SSR`).close();
					setCancelReason("");
					setTerminationDate(new Date());
				}
			});
		} else {
			cancelSubcontractorRequest(sentSubcontractorRequests[currentSSRIndex], cancelReason).then((success) => {
				if (success) {
					document.getElementById(`delete-SSR`).close();
					setCancelReason("");
				}
			});
		}
	};

	const handleReAssignSSR = async (ssr, newSubcontractorId) => {
		if (!ssr || !generatorData?.id || !user?.uid) return;
		setIsReassigning(true);

		try {
			const batch = writeBatch(db);
			const currentTransporterRef = doc(db, COLLECTIONS.transporters, user?.uid);
			const newSubContractorRef = doc(db, COLLECTIONS.transporters, newSubcontractorId);
			const oldSubContractorRef = doc(db, COLLECTIONS.transporters, ssr.subcontractorId);

			const [currentTransporterDoc, newSubContractorDoc, oldSubContractorDoc] = await Promise.all([
				getDoc(currentTransporterRef),
				getDoc(newSubContractorRef),
				getDoc(oldSubContractorRef),
			]);

			if (!currentTransporterDoc.exists() || !newSubContractorDoc.exists()) {
				console.error("One or more required documents do not exist");
				return;
			}

			let currTransporterSharedGens = currentTransporterDoc.data()?.sharedGenerators ?? {};
			let newSubContractorSharedGens = newSubContractorDoc.data()?.sharedGenerators ?? {};
			let oldSubContractorSharedGens = oldSubContractorDoc.exists()
				? oldSubContractorDoc.data()?.sharedGenerators ?? {}
				: {};

			const transporterName = currentTransporterDoc.data().companyDisplayName || "Unknown";
			const subContractorName = newSubContractorDoc.data().companyDisplayName || "Unknown";

			// Remove the SSR from the old subcontractor's toMe array
			if (oldSubContractorDoc.exists()) {
				const updatedToMe = (oldSubContractorSharedGens.toMe || []).filter((request) => request.ssrId !== ssr.ssrId);

				batch.update(oldSubContractorRef, {
					sharedGenerators: {
						...oldSubContractorSharedGens,
						toMe: updatedToMe,
					},
				});
			}

			// Update the existing SSR with the new subcontractor info
			const updatedSSR = {
				...ssr,
				subcontractorId: newSubcontractorId,
				subContractorName,
				status: SERVICE_STATUS.PENDING, // Reset to pending for the new subcontractor
				timeStamp: new Date(),
				reassignedAt: new Date().toISOString(),
			};

			// Update the transporter's fromMe array with the updated SSR
			const updatedFromMe = (currTransporterSharedGens.fromMe || []).map((request) =>
				request.ssrId === ssr.ssrId ? updatedSSR : request
			);

			batch.update(currentTransporterRef, {
				sharedGenerators: {
					...currTransporterSharedGens,
					fromMe: updatedFromMe,
				},
			});

			// Add the updated SSR to the new subcontractor's toMe array
			batch.update(newSubContractorRef, {
				sharedGenerators: {
					...newSubContractorSharedGens,
					toMe: [...(newSubContractorSharedGens.toMe || []), updatedSSR],
				},
			});

			// Create notification for the new subcontractor
			const subcontractorNotificationRef = doc(db, "notifications", newSubcontractorId);
			const notificationDocSnapshot = await getDoc(subcontractorNotificationRef);

			if (!notificationDocSnapshot.exists()) {
				batch.set(subcontractorNotificationRef, {
					created: new Date(),
				});
			}

			const newNotification = {
				id: Date.now().toString(),
				topic: "Reassigned SSR Request",
				type: "SSR_Reassigned",
				message: `A Service Request for ${generatorData.generatorName} has been reassigned to you from ${transporterName}`,
				read: false,
				timeStamp: new Date(),
			};

			const today = new Date();
			const todayISOString = today.toISOString().split("T")[0] + "T00:00:00.000Z";
			const dailyNotificationRef = doc(collection(subcontractorNotificationRef, "dailyNotifications"), todayISOString);

			const dailyNotificationDoc = await getDoc(dailyNotificationRef);

			if (dailyNotificationDoc.exists()) {
				const existingData = dailyNotificationDoc.data();
				let notifications = Array.isArray(existingData.notifications) ? [...existingData.notifications] : [];
				notifications.push(newNotification);
				batch.update(dailyNotificationRef, { notifications });
			} else {
				batch.set(dailyNotificationRef, {
					notifications: [newNotification],
					dateCreated: new Date(),
				});
			}

			await batch.commit();
			setIsReassignModalOpen(false);
			setShowAvailableSubCont(false);
			setSelectedSubAssignee("");
			setToReassign(null);
			showSuccessToastMessage(`Service request successfully reassigned to ${subContractorName}`);
		} catch (error) {
			console.error("Error reassigning SSR:", error);
			showErrorToastMessage("Failed to reassign service request");
		} finally {
			setIsReassigning(false);
		}
	};

	const { fetchSentSubcontractorRequests } = useSSRManagement(user?.uid, generatorData?.id);

	const handleSSRRequestSent = useCallback(async () => {
		if (user?.uid && generatorData?.id) {
			await fetchSentSubcontractorRequests();
			setShowSSRForm(false);
		}
	}, [user?.uid, generatorData?.id]);

	const getEstablishedDate = (index) => {
		() => {
			const date = watchServiceSchedules[index]?.establishedDate;
			if (!date) return "--";
			try {
				if (date && typeof date === "object" && date.seconds !== undefined) {
					return dateFormatter(new Date(date.seconds * 1000));
				}
				if (date instanceof Date) {
					return dateFormatter(date);
				}
				if (typeof date === "string") {
					const parsedDate = new Date(date);
					if (!isNaN(parsedDate.getTime())) {
						return dateFormatter(parsedDate);
					}
				}
				return "--";
			} catch (e) {
				return "--";
			}
		};
	};

	const isReadOnly = useMemo(() => user?.uid !== generatorData?.transporterId, [user, generatorData]);
	const filteredRouteOptions = useMemo(() => {
		const options = [...routeOptions];
		const outOfServiceIndex = options.findIndex((option) => option.label === "Out of Service Network");
		if (outOfServiceIndex !== -1) {
			return options.slice(0, outOfServiceIndex);
		}
		return options;
	}, [routeOptions]);

	if (!generatorData) return <Loader />;

	return (
		<div className="grid bg-white p-8 py-6 mb-6 rounded-cardRadii gap-2 w-full">
			<dialog id={`generator_address_not_found`} className="modal">
				<div className="modal-box">
					<form method="dialog">
						<h3 className="font-bold text-lg">Generator Profile Not Setup</h3>

						<div className="overflow-visible z-10 flex flex-col py-5">
							<p>Generator profile is not setup properly. Please add service address to the profile.</p>
						</div>

						<div className="flex justify-center w-full">
							<button
								type="button"
								className="btn btn-primary btn-sm"
								onClick={() => {
									navigate(`/admin/generators/${generatorData.id}/generator-information`);
								}}
							>
								Go Back to Generator Profile
							</button>
						</div>
					</form>
				</div>
			</dialog>
			<dialog id={`generator_not_contracted`} className="modal">
				<div className="modal-box">
					<form method="dialog">
						<h3 className="font-bold text-lg">Generator Profile Not Setup</h3>

						<div className="overflow-visible z-10 flex flex-col py-5">
							<p>
								Generator profile is not marked as contracted. Please mark the generator as contracted to access this
								page.
							</p>
						</div>

						<div className="flex justify-center w-full">
							<button
								type="button"
								className="btn btn-primary btn-sm"
								onClick={() => {
									navigate(`/admin/generators/${generatorData.id}/generator-information`);
								}}
							>
								Go Back to Generator Profile
							</button>
						</div>
					</form>
				</div>
			</dialog>

			<dialog id={`generator_administrative_account`} className="modal">
				<div className="modal-box">
					<form method="dialog">
						<h3 className="font-bold text-lg">Generator Profile Marked As Administrative Account </h3>
						<div className="overflow-visible z-10 flex flex-col py-5">
							<p>
								Generator profile is marked as administrative account. You can not assign routes for the administrative
								account.
							</p>
						</div>

						<div className="flex justify-center w-full">
							<button
								type="button"
								className="btn btn-primary btn-sm"
								onClick={() => {
									navigate(`/admin/generators/${generatorData.id}/generator-information`);
								}}
							>
								Go Back to Generator Profile
							</button>
						</div>
					</form>
				</div>
			</dialog>
			<dialog id={`generator_marked_as_NIGO_or_parking`} className="modal">
				<div className="modal-box">
					<form method="dialog">
						<h3 className="font-bold text-lg">
							Generator Profile is marked as{" "}
							{generatorStatus.find((status) => status.value == generatorData?.generatorStatus)?.label}
						</h3>

						<div className="overflow-visible z-10 flex flex-col py-5">
							<p>
								Generator profile is marked as{" "}
								{generatorStatus.find((status) => status.value == generatorData?.generatorStatus)?.label}. Please update
								the generator status in order to continue scheduling.
							</p>
						</div>

						<div className="flex justify-center w-full">
							<button
								type="button"
								className="btn btn-primary btn-sm"
								onClick={() => {
									navigate(`/admin/generators/${generatorData?.id}/generator-information`);
								}}
							>
								Go Back to Generator Profile
							</button>
						</div>
					</form>
				</div>
			</dialog>
			<dialog id={`transporter_not_octomarket_user`} className="modal">
				<div className="modal-box">
					<form method="dialog">
						<h3 className="font-bold text-lg">Transporter Octomarket Profile Is Not Setup</h3>

						<div className="overflow-visible z-10 flex flex-col py-5">
							<p>Transporter Octomarket profile is not setup properly. Please setup the Octomarket profile.</p>
						</div>

						<div className="flex justify-center w-full">
							<button
								type="button"
								className="btn btn-primary btn-sm"
								onClick={() => {
									navigate(`/market`);
								}}
							>
								Go to Octomarket
							</button>
						</div>
					</form>
				</div>
			</dialog>
			<dialog id="notify-stakeholders-confirmation" className="modal">
				<div className="modal-box">
					<form method="dialog">
						<h3 className="font-bold text-lg">Are you sure ?</h3>

						<div className="overflow-visible z-10 flex flex-col py-5">
							<p>Are you sure you want to disable notifications to stakeholders for this service?</p>
						</div>

						<div className="flex justify-between gap-4 mt-4">
							<button
								type="button"
								className="btn btn-error btn-sm"
								onClick={() => {
									const currentIndex = parseInt(
										document.getElementById("notify-stakeholders-confirmation").dataset.index
									);
									setValue(`serviceSchedules.${currentIndex}.doNotifyAllUsers`, false, { shouldValidate: false });
									document.getElementById("notify-stakeholders-confirmation").close();
								}}
							>
								No, Keep Notifications
							</button>
							<button
								type="button"
								className="btn btn-primary btn-sm"
								onClick={() => {
									const currentIndex = parseInt(
										document.getElementById("notify-stakeholders-confirmation").dataset.index
									);
									setValue(`serviceSchedules.${currentIndex}.doNotifyAllUsers`, true, { shouldValidate: false });
									document.getElementById("notify-stakeholders-confirmation").close();
								}}
							>
								Yes, Disable Notifications
							</button>
						</div>
					</form>
				</div>
			</dialog>
			<GeneratorInfoHeader
				generatorData={generatorData ?? {}}
				user={user}
				transporterName={transporterName}
				isReadOnly={isReadOnly}
			/>
			<MemoizedMapSection
				generatorData={generatorData}
				allRoutes={allRoutes}
				selectedRouteIds={selectedRouteIds}
				allGeneratorsData={allGeneratorsData}
				allTreatmentData={allTreatmentData}
				allVendorData={allVendorData}
				prevServiceSchedules={prevServiceSchedules}
				routeOptions={routeOptions}
			/>
			{console.log("Generator Data", generatorData?.transporterId, user?.uid)}
			{activeSentSSRs.length > 0 && generatorData?.transporterId !== user?.uid && (
				<div>
					<div className="flex items-center gap-4 border-b border-[#CCCCCC] ">
						<h6 className="font-medium py-2 text-lg">Subcontractor Service Requests (SSR)</h6>
						<RouteAssignmentOctoInfoPanel />
					</div>
					{activeSentSSRs.map((ssr, index) => (
						<div key={ssr.ssrId || index} className="pb-4">
							<SsrFormComponent
								isReadOnly={true}
								ssrData={ssr}
								control={control}
								trigger={trigger}
								setValue={setValue}
								getValues={getValues}
								watch={watch}
								errors={errors}
								serviceFrequencyOptions={serviceFrequencyOptions}
								weekdayOptions={weekdayOptions}
								subcontractorServiveFrequencyOptions={subcontractorServiveFrequencyOptions}
								subContractorData={subContractorData}
								itemsMap={itemsMap}
								serviceTypes={serviceTypes}
								subContractorContainers={subContractorContainers}
								itemsOptions={itemsOptions}
								handleSubcontractorSelected={handleSubcontractorSelected}
								SERVICE_TYPES={SERVICE_TYPES}
								serviceNoteRef={serviceNoteRef}
								KeepContainers={KeepContainers}
								setKeepContainers={setKeepContainers}
								serviceDurationOptions={serviceDurationOptions}
								transporterData={transporterData}
								currentUserId={user?.uid}
								generatorData={generatorData}
							/>
						</div>
					))}
				</div>
			)}
			<h6 className="font-medium py-2 text-lg border-b border-[#CCCCCC]">Scope Of Work (SOW)</h6>
			<form className="flex flex-col gap-2">
				{fields.map((field, index) => (
					<div key={field.id || Date.now() + Math.random()} className="border-b border-gray-100">
						<div className="flex gap-8 w-full ">
							<div className="w-1/2">
								<Controller
									name={`serviceSchedules.${index}.routeId`}
									control={control}
									rules={{ required: "Route is required" }}
									render={({ field: { onChange, value } }) => (
										<Dropdown
											label="Route"
											options={isReadOnly ? filteredRouteOptions : routeOptions}
											value={value}
											onChange={(e) => {
												onChange(e);
												trigger(`serviceSchedules.${index}.routeId`, { shouldFocus: true });
											}}
											isRequired={true}
										/>
									)}
								/>
								{errors.serviceSchedules?.[index]?.routeId && (
									<p className="text-red-500 text-sm mt-1">{errors.serviceSchedules[index].routeId.message}</p>
								)}
								<Controller
									name={`serviceSchedules.${index}.serviceFrequency.type`}
									control={control}
									rules={{ required: "Service Frequency is required" }}
									render={({ field: { onChange, value } }) => (
										<Dropdown
											label="Service Frequency"
											options={serviceFrequencyOptions}
											value={value}
											onChange={(e) => {
												onChange(e);
												trigger(`serviceSchedules.${index}.serviceFrequency.type`, { shouldFocus: true });
											}}
											isRequired={true}
											noCursor={field?.isWillCall}
											listHeight={"max-h-64"}
										/>
									)}
								/>
								{errors.serviceSchedules?.[index]?.serviceFrequency?.type && (
									<p className="text-red-500 text-sm mt-1">
										{errors.serviceSchedules[index].serviceFrequency.type.message}
									</p>
								)}
								{watchServiceSchedules[index]?.serviceFrequency?.type === "MTWM" && (
									<Controller
										name={`serviceSchedules.${index}.serviceFrequency.days`}
										control={control}
										rules={{ required: "Weekdays are required for multiple times weekly" }}
										render={({ field: { onChange, value } }) => (
											<div className="w-full flex">
												<p className="w-1/3 whitespace-nowrap truncate">Select Weekdays *</p>
												<div className="w-2/3">
													<MultiSelectRounded
														value={value}
														onChange={(e) => {
															onChange(e);
															if (watchServiceSchedules[index]?.serviceFrequency?.type === "MTWM") {
																trigger(`serviceSchedules.${index}.serviceFrequency.days`, { shouldFocus: true });
															}
														}}
														options={weekdayOptions}
														id={`weekdays-input-${index}`}
														styles="flex flex-col w-full gap-1"
														margin="0"
													/>
												</div>
											</div>
										)}
									/>
								)}
								<div className="flex items-center justify-between my-4">
									<label htmlFor={`anchorDate-${index}`} className="truncate text-inputLabel font-normal">
										{field?.isWillCall ? "Will Call Date " : "Anchor Date "}*
									</label>
									<div className="w-2/3">
										<Controller
											name={`serviceSchedules.${index}.anchorDate`}
											control={control}
											rules={{
												required: "Anchor date is required.",
											}}
											render={({ field: { value, onChange } }) => (
												<CustomDatePicker
													selectedDate={value}
													setSelectedDate={(value) => {
														console.log({ value });
														onChange(value);
														trigger(`serviceSchedules.${index}.anchorDate`, { shouldFocus: true });
													}}
													label={"Anchor Date *"}
													startYear={new Date().getFullYear()}
													endYear={new Date().getFullYear() + 5}
													yearReversed={true}
													minDate={new Date()}
												/>
											)}
										/>
									</div>
								</div>

								{errors.serviceSchedules?.[index]?.anchorDate && (
									<p className="text-red-500 text-sm mt-1">{errors.serviceSchedules[index].anchorDate.message}</p>
								)}

								{watchServiceSchedules[index]?.id && (
									<div className="flex items-center justify-between my-4">
										<label htmlFor={`establishedDate-${index}`} className="truncate text-inputLabel font-normal">
											Established Date
										</label>
										<div className="w-2/3">
											<div className="bg-gray-100 p-2 rounded-full px-4 text-cardTextGray">
												{(() => {
													const date = watchServiceSchedules[index]?.establishedDate;
													if (!date) return "--";
													const getFormattedDate = (dateValue) => {
														try {
															if (dateValue && typeof dateValue === "object" && dateValue.seconds !== undefined) {
																return dateFormatter(new Date(dateValue.seconds * 1000));
															}
															if (dateValue instanceof Date) {
																return dateFormatter(dateValue);
															}
															if (typeof dateValue === "string") {
																const parsedDate = new Date(dateValue);
																if (!isNaN(parsedDate.getTime())) {
																	return dateFormatter(parsedDate);
																}
															}
															return "--";
														} catch (e) {
															return "--";
														}
													};

													return getFormattedDate(date);
												})()}
											</div>
										</div>
									</div>
								)}
								<div className="flex items-center mt-2 mb-2">
									<input
										type="checkbox"
										id={`doNotifyAllUsers-${index}`}
										checked={watchServiceSchedules[index]?.doNotifyAllUsers || false}
										onChange={(e) => {
											if (e.target.checked) {
												const dialog = document.getElementById("notify-stakeholders-confirmation");
												dialog.dataset.index = index.toString();
												dialog.showModal();
											} else {
												setValue(`serviceSchedules.${index}.doNotifyAllUsers`, false, { shouldValidate: false });
											}
										}}
										className="mr-2"
									/>
									<label htmlFor={`doNotifyAllUsers-${index}`} className="truncate text-inputLabel font-normal">
										Do not notify stakeholder of this change in service{" "}
									</label>
								</div>
							</div>
							<div className="w-1/2 ">
								<Controller
									name={`serviceSchedules.${index}.serviceType`}
									control={control}
									rules={{ required: "Service Type is required." }}
									render={({ field: { onChange, value } }) => {
										const selectedRoute = allRoutesOptions.find((r) => r.id === watchServiceSchedules[index]?.routeId);
										const allowedTypes = selectedRoute?.type || [];
										const filteredServiceTypes = serviceTypes.filter((st) => allowedTypes.includes(st.value));
										return (
											<Dropdown
												label="Service Type"
												id={`service-input-${index}`}
												options={filteredServiceTypes.map((item) => ({
													label: item.label,
													value: item.value,
												}))}
												value={value}
												onChange={(e) => {
													onChange(e);
													trigger(`serviceSchedules.${index}.serviceType`, { shouldFocus: true });
													if (
														!(
															(e === SERVICE_TYPES.PAPER_SHREDDING && value === SERVICE_TYPES.PAPER_SHREDDING) ||
															(e === SERVICE_TYPES.PAPER_SHREDDING &&
																value === SERVICE_TYPES.ON_SITE_PAPER_SHREDDING) ||
															(e === SERVICE_TYPES.ON_SITE_PAPER_SHREDDING &&
																value === SERVICE_TYPES.PAPER_SHREDDING) ||
															(e === SERVICE_TYPES.ON_SITE_PAPER_SHREDDING &&
																value === SERVICE_TYPES.ON_SITE_PAPER_SHREDDING)
														)
													) {
														setValue(`serviceSchedules.${index}.expectedItemOrService`, []);
													}
												}}
												isRequired={true}
												disabledBgColor="white"
												disabledTextColor="gray-300"
											/>
										);
									}}
								/>
								{errors.serviceSchedules?.[index]?.serviceType && (
									<p className="text-red-500 text-sm mt-1">{errors.serviceSchedules[index].serviceType.message}</p>
								)}
								<Controller
									name={`serviceSchedules.${index}.serviceDuration`}
									control={control}
									rules={{ required: "Service Duration is required." }}
									render={({ field: { onChange, value } }) => (
										<Dropdown
											label="Service Duration"
											options={serviceDurationOptions}
											value={value}
											onChange={(e) => {
												onChange(e);
												trigger(`serviceSchedules.${index}.serviceDuration`, { shouldFocus: true });
											}}
											isRequired={true}
										/>
									)}
								/>
								{errors.serviceSchedules?.[index]?.serviceType && (
									<p className="text-red-500 text-sm mt-1">{errors.serviceSchedules[index].serviceType.message}</p>
								)}
								<Controller
									name={`serviceSchedules.${index}.expectedItemOrService`}
									control={control}
									rules={{
										required: "Expected Container is required.",
										validate: (value) => {
											return (
												value.every((item) => item.quantity >= 1 && item.quantity <= 999) ||
												"Quantity must be between 1 and 999"
											);
										},
									}}
									render={({ field: { value, onChange } }) => (
										<div className="w-full flex flex-col gap-4">
											<div className="w-full flex">
												<p className="w-1/3 whitespace-nowrap truncate text-inputLabel font-normal">
													Expected Container(s) *
												</p>
												<div className="w-2/3">
													<MultiSelectRounded
														isDisabled={!formValues.serviceSchedules[index].serviceType}
														value={value.map((v) => v.item)}
														onChange={(selectedItems) => {
															const transformedItems = selectedItems.map((item) => {
																const existingItem = value.find((v) => v.item === item);
																return {
																	item,
																	quantity: existingItem ? existingItem.quantity : 1,
																};
															});
															onChange(transformedItems);
															trigger(`serviceSchedules.${index}.expectedItemOrService`, { shouldFocus: true });
														}}
														options={groupContainersBySubWasteType(
															itemsOptions.filter((item) =>
																formValues.serviceSchedules[index].serviceType === SERVICE_TYPES.MEDICAL_WASTE
																	? item.subWasteType !== "Paper Shredding"
																	: item.subWasteType === "Paper Shredding"
															)
														)}
														isRequired={true}
														id={`expected-items-services-${index}`}
														styles="flex flex-col w-full gap-1 min-h-9"
														margin="0"
													/>
												</div>
											</div>
											{value?.length > 0 && value && value?.[0]?.item?.length > 0 && (
												<div className="mb-4 flex flex-col gap-4">
													{value.map((itemObj, itemIndex) => (
														<div key={itemObj.item} className="flex items-center ">
															<span className="text-base w-1/3 text-inputLabel truncate whitespace-nowrap max-h-9 overflow-hidden">
																{itemsMap?.[itemObj.item]?.length > 40
																	? itemsMap?.[itemObj.item]
																	: itemsMap?.[itemObj.item]}
															</span>
															<div className="relative w-2/3">
																<input
																	//type="number"
																	min="1"
																	max="999"
																	value={itemObj.quantity}
																	onChange={(e) => {
																		const newQuantity = Math.min(Math.max(1, Number(e.target.value)), 999);
																		const updatedItems = [...value];
																		updatedItems[itemIndex] = { ...itemObj, quantity: newQuantity };
																		onChange(updatedItems);
																	}}
																	className="p-2 pr-8 w-full pl-3 text-left text-sm bg-inputBg rounded-full outline-none focus:ring-1 focus:ring-dashInActiveBtnText appearance-none"
																/>

																{/* Increase Button (Up Arrow) */}
																<button
																	type="button"
																	onClick={() => {
																		const newQuantity = Math.min(itemObj.quantity + 1, 999);
																		const updatedItems = [...value];
																		updatedItems[itemIndex] = { ...itemObj, quantity: newQuantity };
																		onChange(updatedItems);
																	}}
																	className="absolute right-2 top-1 text-gray-500 hover:text-gray-700"
																>
																	<HiOutlineChevronUp className="w-4 h-4" />
																</button>

																{/* Decrease Button (Down Arrow) */}
																<button
																	type="button"
																	onClick={() => {
																		const newQuantity = Math.max(itemObj.quantity - 1, 1);
																		const updatedItems = [...value];
																		updatedItems[itemIndex] = { ...itemObj, quantity: newQuantity };
																		onChange(updatedItems);
																	}}
																	className="absolute right-2 bottom-1 text-gray-500 hover:text-gray-700"
																>
																	<HiOutlineChevronDown className="w-4 h-4" />
																</button>
															</div>
														</div>
													))}
												</div>
											)}
										</div>
									)}
								/>
								{errors.serviceSchedules?.[index]?.expectedItemOrService && (
									<p className="text-red-500 text-sm mt-1">
										{errors.serviceSchedules[index].expectedItemOrService?.message}
									</p>
								)}
							</div>
						</div>

						{watchServiceSchedules[index]?.serviceFrequency?.type === "WC" &&
						watchServiceSchedules[index]?.anchorDate?.length > 0 ? (
							<div className="mb-4 w-full">
								<h6 className="font-medium pb-2">Next Service</h6>
								<div className="flex gap-2 flex-wrap">
									<div className="items-center bg-gray-100 rounded-full px-8 py-1 text-sm text-gray-700 mr-2 mb-2">
										<p>{dateFormatter(watchServiceSchedules[index].anchorDate)}</p>
										{renderUpcomingOperatingHours(watchServiceSchedules[index].anchorDate)}
									</div>
								</div>
							</div>
						) : (
							watchServiceSchedules[index]?.upcomingDates?.length > 0 && (
								<div className="mb-4 w-full">
									<h6 className="font-medium pb-2">Next 6 Services If Saved</h6>
									<div className="flex gap-2 flex-wrap">
										{watchServiceSchedules[index].upcomingDates.map((date, dateIndex) => {
											return (
												<div
													key={dateIndex}
													className="items-center bg-gray-100 rounded-full px-5 py-1 text-sm text-gray-700 mr-2 mb-2"
												>
													<p>
														{watchServiceSchedules[index].serviceFrequency.type === "MTWM"
															? formatUtcDateString(date)
															: dateFormatter(date)}
													</p>
													{renderUpcomingOperatingHours(
														watchServiceSchedules[index].serviceFrequency.type === "MTWM"
															? formatUtcDateString(date)
															: dateFormatter(date)
													)}
												</div>
											);
										})}
									</div>
								</div>
							)
						)}

						{
							<div className="w-full flex justify-end p-2 gap-5">
								{fields.length > 0 && (
									<button
										type="button"
										className="rounded-full px-4 py-1 min-w-40 text-sm border border-black hover:bg-cardTextGray hover:bg-opacity-10 "
										onClick={async () => {
											if (watchServiceSchedules[index]?.id) {
												document.getElementById(`delete-schedule-services-${index}`).showModal();
											} else {
												remove(index);
											}
										}}
									>
										{currentServiceSchedules.find((el) => el.id === watchServiceSchedules[index]?.id)?.isProcessing ? (
											<Loader height="h-8 pt-1.5" />
										) : (
											"Remove service schedule"
										)}
									</button>
								)}
								<button
									type="button"
									disabled={
										!isUpdating(prevServiceSchedules[index], formValues.serviceSchedules[index]) || disableButton
									}
									className={`p-2 flex items-center justify-center px-4 min-w-40 bg-primary-500 hover:bg-primary-500/90 disabled:bg-cardTextGray text-white rounded-full text-center `}
									onClick={async () => {
										const res = await trigger(`serviceSchedules.${index}`, { shouldFocus: true });
										if (!res) return;
										setDisableButton(true);
										handleSave(index);
									}}
								>
									{currentServiceSchedules.find((el) => el.id === formValues?.serviceSchedules[index]?.id)
										?.isProcessing ? (
										<Loader height="h-8 pt-1.5" />
									) : formValues?.serviceSchedules[index]?.id ? (
										"Update"
									) : (
										"Add to Route"
									)}
								</button>
							</div>
						}
						<dialog id={`delete-schedule-services-${index}`} className="modal">
							<div className="modal-box">
								<div>
									{/* if there is a button in form, it will close the modal */}
									<button
										className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
										type="button"
										onClick={() => {
											document.getElementById(`delete-schedule-services-${index}`).close();
										}}
									>
										✕
									</button>
								</div>
								<h3 className="font-bold text-lg">Are you sure?</h3>
								<div className="flex py-5 gap-5 flex-col">
									<p className="">Proceeding with this operation will affect pending services.</p>
									<p className="text-sm">
										On confirmation the pending services will be deleted and this schedule will be removed. However this
										operation will not delete any complete, inprogress or cancelled services. This operation cannot be
										undone.
									</p>
									<p>Enter Note for Cancellation *</p>
									<textarea
										rows={3}
										onChange={(e) => setCancelReason(e.target.value)}
										className={` w-full text-cardTextGray bg-inputBg border-none rounded-[20px] py-2 h-28 px-2 leading-tight focus:outline-none  focus:ring-1 focus:ring-dashInActiveBtnText`}
									/>
								</div>
								<div className="flex w-full justify-between">
									<button
										className="btn btn-error btn-sm"
										type="button"
										onClick={() => {
											if (!cancelReason) {
												showErrorToastMessage("Cancellation note is required.");
												return;
											}
											deleteSchedule(field, index);
											document.getElementById(`delete-schedule-services-${index}`).close();
										}}
									>
										Remove Schedule
									</button>
									<button
										type="button"
										className="btn btn-primary btn-sm"
										onClick={() => {
											document.getElementById(`delete-schedule-services-${index}`).close();
										}}
									>
										Keep Schedule
									</button>
								</div>
							</div>
						</dialog>
					</div>
				))}
			</form>
			<>
				{activeSentSSRs.length > 0 && generatorData?.transporterId === user?.uid && (
					<div>
						<div className="flex items-center gap-4 border-b border-[#CCCCCC]">
							<h6 className="font-medium py-2 text-lg   ">Subcontractor Service Requests (SSR)</h6>
							<RouteAssignmentOctoInfoPanel />
						</div>
						{activeSentSSRs.map((ssr, index) => (
							<div key={ssr.ssrId || index} className="pb-4">
								{console.log("isRecieved", ssr)}
								<SsrFormComponent
									isReadOnly={true}
									ssrData={ssr}
									control={control}
									trigger={trigger}
									setValue={setValue}
									getValues={getValues}
									watch={watch}
									errors={errors}
									serviceFrequencyOptions={serviceFrequencyOptions}
									weekdayOptions={weekdayOptions}
									subcontractorServiveFrequencyOptions={subcontractorServiveFrequencyOptions}
									subContractorData={subContractorData}
									itemsMap={itemsMap}
									serviceTypes={serviceTypes}
									subContractorContainers={subContractorContainers}
									itemsOptions={itemsOptions}
									handleSubcontractorSelected={handleSubcontractorSelected}
									SERVICE_TYPES={SERVICE_TYPES}
									serviceNoteRef={serviceNoteRef}
									KeepContainers={KeepContainers}
									setKeepContainers={setKeepContainers}
									serviceDurationOptions={serviceDurationOptions}
									transporterData={transporterData}
									currentUserId={user?.uid}
								/>
								{!isReadOnly && (
									<SsrActionButtons
										isReadOnly={true}
										ssr={ssr}
										currentSSRIndex={sentSubcontractorRequests.findIndex((r) => r.ssrId === ssr.ssrId)}
										setCurrentSSRIndex={setCurrentSSRIndex}
										sentSubcontractorRequests={sentSubcontractorRequests}
									/>
								)}
							</div>
						))}
					</div>
				)}
				{showSSRFrom && (
					<div className="mb-8 pb-4">
						<div className="mb-8 pb-4">
							<SsrFormStandalone
								generatorData={generatorData}
								transporterData={transporterData}
								userId={user?.uid}
								onClose={() => setShowSSRForm(false)}
								serviceTypes={serviceTypes}
								weekdayOptions={weekdayOptions}
								serviceDurationOptions={serviceDurationOptions}
								SERVICE_TYPES={SERVICE_TYPES}
								subcontractorServiveFrequencyOptions={subcontractorServiveFrequencyOptions}
								serviceFrequencyOptions={serviceFrequencyOptions}
								onRequestSent={handleSSRRequestSent}
							/>
						</div>
					</div>
				)}

				<dialog id={`delete-SSR`} className="modal">
					<div className="modal-box">
						<div>
							<button
								className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
								type="button"
								onClick={() => {
									document.getElementById(`delete-SSR`).close();
									setCancelReason("");
								}}
							>
								✕
							</button>
						</div>
						<h3 className="font-bold text-lg">Are You Sure ?</h3>
						<div className="flex py-5 gap-5 flex-col">
							<p className="">{`Proceeding with this operation will ${
								selectedSSR?.status === SERVICE_STATUS.ACCEPTED ? "terminate" : "cancel"
							} the Subcontractor Service Request`}</p>
							{selectedSSR?.status === SERVICE_STATUS.ACCEPTED && (
								<>
									<p>Requested Termination Date *</p>
									<div className="w-2/3 h-2/3">
										<CustomDatePicker
											selectedDate={terminationDate}
											setSelectedDate={setTerminationDate}
											label={"Termination Date"}
											startYear={new Date().getFullYear()}
											endYear={new Date().getFullYear() + 5}
											yearReversed={true}
											minDate={new Date()}
										/>
									</div>
								</>
							)}
							<p>{`Enter Note for ${
								selectedSSR?.status === SERVICE_STATUS.ACCEPTED ? "termination" : "cancelation"
							}  *`}</p>

							<textarea
								rows={3}
								value={selectedSSR?.status === SERVICE_STATUS.ACCEPTED ? terminationNote : cancelReason}
								onChange={(e) => {
									if (selectedSSR?.status === SERVICE_STATUS.ACCEPTED) {
										setTerminationNote(e.target.value);
									} else {
										setCancelReason(e.target.value);
									}
								}}
								className="w-full text-cardTextGray bg-inputBg border-none rounded-[20px] py-2 h-28 px-2 leading-tight focus:outline-none focus:ring-1 focus:ring-dashInActiveBtnText"
							/>
						</div>
						<div className="flex w-full justify-between">
							<button className="btn btn-error btn-sm" type="button" onClick={handleCancelCurrentSSR}>
								{`${selectedSSR?.status === SERVICE_STATUS.ACCEPTED ? "Terminate" : "Cancel"}  Request`}
							</button>
							<button
								type="button"
								className="btn btn-primary btn-sm"
								onClick={() => {
									document.getElementById(`delete-SSR`).close();
									setCancelReason("");
								}}
							>
								Keep Request
							</button>
						</div>
					</div>
				</dialog>
			</>
			{isReassignModalOpen && (
				<div className="z-40 fixed inset-0 bg-[#CCCCCC87] bg-opacity-50 flex justify-center items-center">
					<div className="bg-white z-20 rounded-cardRadii max-w-md w-full min-h-fit">
						{!showAvailableSubCont ? (
							<div className="flex flex-col justify-between min-h-52 p-6">
								<h6 className="text-2xl font-semibold">Are you sure?</h6>
								<p className="text-lg">You are about to assign this SSR to a new subcontractor.</p>
								<div className="flex justify-end gap-2">
									<button
										onClick={() => setIsReassignModalOpen(false)}
										className="bg-[#F3F3F3] rounded-full w-24 p-1 px-4"
									>
										No
									</button>
									<button
										onClick={() => setShowAvailableSubCont(true)}
										className="px-4 py-1 w-24 bg-primary transition-colors duration-200 text-white rounded-full"
									>
										Yes
									</button>
								</div>
							</div>
						) : (
							<div className="flex flex-col justify-between min-h-40 p-6">
								<h6 className="text-2xl font-semibold mb-4">Reassign</h6>
								<div>
									<SearchableDropdownForParents
										label="Subcontractor"
										options={subContractorData.map((sub) => ({
											label: sub.contractorName || sub.name || "Unknown",
											value: sub.id,
											octoNumber: sub.octoNumber || "",
											internalAccountNumber: sub.internalAccountNumber || "",
										}))}
										value={selectedSubAssignee}
										onChange={(val) => setSelectedSubAssignee(val)}
										placeholder="Search subcontractors..."
										styles="flex-col min-w-full"
									/>
								</div>
								<div className="flex justify-end gap-2 mt-6">
									<button
										onClick={() => {
											setShowAvailableSubCont(false);
											setIsReassignModalOpen(false);
										}}
										className="bg-[#F3F3F3] rounded-full w-24 p-1 px-4"
									>
										Cancel
									</button>
									<button
										onClick={async () => {
											if (selectedSubAssignee && toReassign) {
												await handleReAssignSSR(toReassign, selectedSubAssignee);
											}
										}}
										className={`px-4 py-1 w-36 bg-primary transition-colors duration-200 text-white rounded-full ${
											!selectedSubAssignee ? "opacity-50 cursor-not-allowed" : ""
										}`}
										disabled={!selectedSubAssignee || isReassigning}
									>
										{isReassigning ? "Reassigning..." : "Reassign"}
									</button>
								</div>
							</div>
						)}
					</div>
				</div>
			)}
			{console.log(
				"Accepted ssr",
				activeSentSSRs.filter((el) => el.status == SERVICE_STATUS.ACCEPTED || el.status == "TERMINATED").length
			)}
			<div className="grid items-center justify-center relative">
				{generatorData.transporterId == user?.uid && renderSSRButton()}
				<div className="ml-auto absolute top-0 right-0">
					{(activeSentSSRs.filter((el) => el.status == SERVICE_STATUS.ACCEPTED || el.status == "TERMINATED").length >
						0 ||
						!isReadOnly) &&
						renderAddMoreServiceButtons()}
				</div>
			</div>

			<div className="py-5">
				<div className="flex flex-col gap-2">
					<div className="w-full grid gap-3">
						<div className="flex gap-10 border-b border-[#CCCCCC]">
							<h6 className="font-medium py-2 text-lg ">Reminders/Notifications</h6>
							<label htmlFor="reminder-notification" className="flex items-center text-gray-500 gap-5">
								<input
									type="checkbox"
									name=""
									id="reminder-notification"
									className="w-4 h-4 bg-white"
									defaultChecked={generatorData?.sendToStakeHolder}
									onChange={(e) => {
										if (e.currentTarget?.checked) {
											try {
												updateDoc(doc(db, COLLECTIONS.generators, generatorData?.id), { sendToStakeHolder: true });
											} catch (error) {
												console.log(error);
												showInternalServerErrorToastMessage();
											}
										} else {
											try {
												updateDoc(doc(db, COLLECTIONS.generators, generatorData?.id), { sendToStakeHolder: false });
											} catch (error) {
												console.log(error);
												showInternalServerErrorToastMessage();
											}
										}
									}}
								/>
								<p>Send to Stakeholders</p>
							</label>
						</div>
						<div className="flex flex-col sm:flex-row pt-1 items-center gap-6">
							<label className="text-cardTextGray">Service Day Notifications</label>
						</div>
						<div className="flex flex-col gap-6 sm:flex-row items-center">
							<label htmlFor="24-hour-notice" className="flex items-center text-gray-500 gap-5">
								<input
									type="checkbox"
									name=""
									id="24-hour-notice"
									className="w-4 h-4 bg-white"
									defaultChecked={
										generatorData?.notifiPref24Hours
											? generatorData?.notifiPref24Hours
											: serviceSettingData?.serviceDayNotification?.notificationTiming?.sameDayServiceReminder
									}
									onChange={(e) => {
										if (e.currentTarget?.checked) {
											try {
												updateDoc(doc(db, COLLECTIONS.generators, generatorData?.id), { notifiPref24Hours: true });
											} catch (error) {
												console.log(error);
												showInternalServerErrorToastMessage();
											}
										} else {
											try {
												updateDoc(doc(db, COLLECTIONS.generators, generatorData?.id), { notifiPref24Hours: false });
											} catch (error) {
												console.log(error);
												showInternalServerErrorToastMessage();
											}
										}
									}}
								/>
								<p>24 Hour Advance Notice</p>
							</label>
							<label htmlFor="same-day-notice" className="flex items-center text-gray-500 gap-5">
								{console.log("serviceSettingsDta", serviceSettingData)}
								<input
									type="checkbox"
									name=""
									id="same-day-notice"
									className="w-4 h-4 bg-white"
									defaultChecked={
										generatorData?.notifiPrefServiceDay
											? generatorData?.notifiPrefServiceDay
											: serviceSettingData?.serviceDayNotification?.notificationTiming?.advanceServiceReminder
									}
									onChange={(e) => {
										if (e.currentTarget.checked) {
											try {
												updateDoc(doc(db, COLLECTIONS.generators, generatorData?.id), { notifiPrefServiceDay: true });
											} catch (error) {
												console.log(error);
												showInternalServerErrorToastMessage();
											}
										} else {
											try {
												updateDoc(doc(db, COLLECTIONS.generators, generatorData?.id), { notifiPrefServiceDay: false });
											} catch (error) {
												console.log(error);
												showInternalServerErrorToastMessage();
											}
										}
									}}
								/>
								<p>Same Day Notice</p>
							</label>
						</div>
					</div>
				</div>
			</div>
			<form onSubmit={instructionHandleSubmit(instructionSubmitHandler)} className="grid gap-2">
				<div>
					<h6 className="font-medium py-2 text-lg border-b border-[#CCCCCC] mb-2">
						Generator Service Instructions{" "}
						<span className="text-sm text-cardTextGray">(Instructions appear in OCTO Field App)</span>
					</h6>
					<div className="w-full flex flex-col md:flex-row gap-8">
						<div className="w-1/2">
							<Controller
								name="deliveryNote"
								control={instructionControl}
								render={({ field: { onChange, value } }) => (
									<Textarea
										value={value}
										onChange={onChange}
										onBlur={(e) => {
											autoSaveInstructions({ deliveryNote: e.target.value });
										}}
										label="Delivery Note (DEL)"
									/>
								)}
							/>
							{errors.deliveryNote && <p className="text-red-500 text-sm mt-1">{errors.deliveryNote.message}</p>}
							<Controller
								name="parkingNote"
								control={instructionControl}
								render={({ field: { onChange, value } }) => (
									<Textarea
										value={value}
										onChange={onChange}
										onBlur={(e) => {
											autoSaveInstructions({ parkingNote: e.target.value });
										}}
										label="Parking Note (PRK)"
									/>
								)}
							/>
							{errors.parkingNote && <p className="text-red-500 text-sm mt-1">{errors.parkingNote.message}</p>}
							<Controller
								name="locationOfWaste"
								control={instructionControl}
								render={({ field: { onChange, value } }) => (
									<Textarea
										value={value}
										onChange={onChange}
										onBlur={(e) => {
											autoSaveInstructions({ locationOfWaste: e.target.value });
										}}
										label="Location Of Waste (LOC)"
									/>
								)}
							/>
							{errors.locationOfWaste && <p className="text-red-500 text-sm mt-1">{errors.locationOfWaste.message}</p>}
						</div>
						<div className="w-1/2">
							<Controller
								name="lockBoxCode"
								control={instructionControl}
								render={({ field: { onChange, value } }) => (
									<Textarea
										value={value}
										onChange={onChange}
										onBlur={(e) => {
											autoSaveInstructions({ lockBoxCode: e.target.value });
										}}
										label="Access Code"
									/>
								)}
							/>
							{errors.lockBoxCode && <p className="text-red-500 text-sm mt-1">{errors.lockBoxCode.message}</p>}
							<Controller
								name="serviceInstructions"
								control={instructionControl}
								render={({ field: { onChange, value } }) => (
									<Textarea
										value={value}
										onChange={onChange}
										onBlur={(e) => {
											autoSaveInstructions({ serviceInstructions: e.target.value });
										}}
										label="Service Instructions"
										ref={serviceNoteRef}
									/>
								)}
							/>
							{errors.serviceInstruction && (
								<p className="text-red-500 text-sm mt-1">{errors.serviceInstruction.message}</p>
							)}
						</div>
					</div>
				</div>
				<div className="flex">
					<button
						type="submit"
						disabled={!isUpdatingInstruction()}
						className="btn btn-primary btn-md text-base ml-auto disabled:bg-cardTextGray disabled:text-white"
					>
						Save
					</button>
				</div>
			</form>
			<GeneratorUpcomingServices generatorData={generatorData} transporterId={user?.uid} />
			<GeneratorPreviousServices generatorData={generatorData} transporterId={user?.uid} />
		</div>
	);
};

GeneratorRoutes.propTypes = {
	generatorData: PropTypes.object,
	onClickBack: PropTypes.func,
	onNextClick: PropTypes.func,
};

export default GeneratorRoutes;

function calculateUpcomingDates(schedule) {
	if (schedule.anchorDate && schedule.serviceFrequency) {
		let calculatedDates = [];
		if (schedule.serviceFrequency.type === "WC") {
			calculatedDates = [];
		} else if (schedule.serviceFrequency.type === "MTWM") {
			if (schedule.serviceFrequency.days.length > 0) {
				const anchorDate = new Date(schedule.anchorDate);
				const anchorUTC = new Date(Date.UTC(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate()));

				calculatedDates = getUpcomingWeekdays(anchorUTC, schedule.serviceFrequency.days, 6);
			}
		} else {
			calculatedDates = getUpcomingDates(new Date(schedule.anchorDate), schedule.serviceFrequency.type, 6);
		}
		return calculatedDates;
	}
	return [];
}

const SsrFormStandalone = ({
	generatorData,
	transporterData,
	userId,
	onClose,
	serviceTypes,
	weekdayOptions,
	serviceDurationOptions,
	SERVICE_TYPES,
	subcontractorServiveFrequencyOptions,
	serviceFrequencyOptions,
	onRequestSent,
}) => {
	const {
		control: ssrControl,
		handleSubmit: ssrHandleSubmit,
		formState: { errors: ssrErrors },
		watch: ssrWatch,
		setValue: ssrSetValue,
		getValues: ssrGetValues,
		reset: ssrReset,
		trigger: ssrTrigger,
		register: ssrRegister,
	} = useForm({
		defaultValues: {
			selectedSubContractor: null,
			serviceSchedules: {
				serviceType: "",
				serviceDuration: "15",
				serviceFrequency: {
					type: "",
					days: [],
				},
				expectedItemOrService: [],
			},
			requestedStartDate: null,
			serviceNote: "",
		},
		mode: "onChange",
	});

	useEffect(() => {
		ssrRegister("selectedSubContractor", {
			required: "Subcontractor is required",
		});

		ssrRegister("serviceSchedules.serviceFrequency.type", {
			required: "Service Frequency is required",
		});
		ssrRegister("serviceSchedules.serviceFrequency.days", {
			validate: (value) => {
				const freqType = ssrWatch("serviceSchedules.serviceFrequency.type");
				return freqType !== "MTWM" || (value && value.length > 0) || "Please select at least one weekday";
			},
		});

		ssrRegister("requestedStartDate", {
			required: "Start Date is required",
		});

		ssrRegister("serviceSchedules.serviceType", {
			required: "Service Type is required",
		});

		ssrRegister("serviceSchedules.serviceDuration", {
			required: "Service Duration is required",
		});

		ssrRegister("serviceSchedules.expectedItemOrService", {
			validate: (value) => (Array.isArray(value) && value.length > 0) || "At least one container must be selected",
		});
	}, [ssrRegister, ssrWatch]);

	const [currentSSRIndex, setCurrentSSRIndex] = useState(0);
	const [KeepContainers, setKeepContainers] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const serviceNoteRef = React.createRef();

	const {
		subContractorContainers,
		handleSubcontractorSelected,
		subContractorData,
		activeSentSSRs,
		sendSubcontractorRequest,
		fetchSentSubcontractorRequests,
		itemsMap,
		itemsOptions,
	} = useSSRManagement(userId, generatorData?.id);

	const onSubmit = useCallback(
		async (data) => {
			try {
				setIsSubmitting(true);
				const success = await sendSubcontractorRequest(data, transporterData, generatorData);
				if (success) {
					await fetchSentSubcontractorRequests();
					if (onRequestSent) {
						onRequestSent();
					}

					ssrReset();
					if (onClose) onClose();
				}
			} catch (error) {
				console.error("Error submitting SSR form:", error);
			} finally {
				setIsSubmitting(false);
			}
		},
		[
			sendSubcontractorRequest,
			fetchSentSubcontractorRequests,
			transporterData,
			generatorData,
			onClose,
			ssrReset,
			onRequestSent,
		]
	);

	return (
		<div className="ssr-standalone-container">
			<form onSubmit={ssrHandleSubmit(onSubmit)}>
				<SsrFormComponent
					isReadOnly={false}
					ssrData={activeSentSSRs[currentSSRIndex]}
					control={ssrControl}
					trigger={ssrTrigger}
					setValue={ssrSetValue}
					getValues={ssrGetValues}
					watch={ssrWatch}
					errors={ssrErrors}
					serviceFrequencyOptions={serviceFrequencyOptions}
					weekdayOptions={weekdayOptions}
					subcontractorServiveFrequencyOptions={subcontractorServiveFrequencyOptions}
					subContractorData={subContractorData}
					itemsMap={itemsMap}
					serviceTypes={serviceTypes}
					subContractorContainers={subContractorContainers}
					itemsOptions={itemsOptions}
					handleSubcontractorSelected={handleSubcontractorSelected}
					SERVICE_TYPES={SERVICE_TYPES}
					serviceNoteRef={serviceNoteRef}
					KeepContainers={KeepContainers}
					setKeepContainers={setKeepContainers}
					serviceDurationOptions={serviceDurationOptions}
					transporterData={transporterData}
					currentUserId={userId}
					generatorData={generatorData}
				/>

				<div className="w-full flex justify-end p-2 gap-4">
					<button
						type="button"
						className="rounded-full px-4 py-2 text-sm border border-gray-500 hover:bg-gray-100 transition"
						onClick={onClose}
						disabled={isSubmitting}
					>
						Cancel
					</button>
					<button
						type="submit"
						className="rounded-full px-4 py-2 text-sm bg-primary-500 hover:bg-primary-500/90 text-white transition"
						disabled={isSubmitting}
					>
						{isSubmitting ? "Sending..." : "Send To Subcontractor"}
					</button>
				</div>
			</form>
		</div>
	);
};

export function RouteAssignmentOctoInfoPanel() {
	const statusColors = {
		Pending: "text-yellow-800",
		Accepted: "text-green-800",
		Declined: "text-red-800",
		Cancelled: "text-gray-800",
		"Termination Requested": "text-yellow-800",
		Terminated: "text-gray-800",
	};

	const statusList = [
		{
			key: "Pending",
			label: "Pending",
			description: "The request has been sent and is awaiting action.",
		},
		{
			key: "Accepted",
			label: "Accepted",
			description: "The request has been accepted and the service relationship is now active.",
		},
		{
			key: "Declined",
			label: "Declined",
			description: "The request has been rejected by the recipient.",
		},
		{
			key: "Cancelled",
			label: "Cancelled",
			description: "The request was cancelled by the sender before acceptance.",
		},
		{
			key: "Termination Requested",
			label: "Termination Requested",
			description: "A request has been made to terminate an active SSR (service will end soon).",
		},
		{
			key: "Terminated",
			label: "Terminated",
			description: "The SSR has been formally terminated and the service relationship ended.",
		},
	];

	const explainerContent = (
		<div className="space-y-4">
			<div>
				<div className="font-semibold mb-2">What is a Subcontractor Service Request (SSR)?</div>
				<div className="text-gray-700 text-md mb-2">
					An SSR is an official request you send to a subcontractor to perform services at a generator location on your
					behalf. This request tracks the relationship and status of subcontracted services in OCTO.
				</div>
				<div className="mt-4 text-xs text-gray-700">
					<span className="font-semibold">Important:</span>
					<ul className="list-disc ml-5">
						<li>
							Once you send a SSR to a subcontractor, you <span className="font-semibold">cannot modify</span> its
							details. If you need to change anything, you must cancel and create a new SSR.
						</li>
						<li>You can cancel a pending SSR at any time before it is accepted for an active SSR.</li>
						<li>
							You cannot cancel an accepted SSR at any point after it is accepted by the subcontractor. You can only
							request termination, which will end the service relationship after the agreed period.
						</li>
					</ul>
					<div className="mt-2">You can view and act on each SSR based on its current status in the status column.</div>
				</div>
			</div>
			<div>
				<div className="font-semibold mb-2">Subcontractor Service Request (SSR) Status System:</div>
				<ul className="list-none ml-0 mt-2 space-y-2 text-sm">
					{statusList.map((status) => (
						<li key={status.key} className="flex items-center gap-2">
							<span
								className={`inline-block font-semibold text-xs mr-1 min-w-20 text-center ${statusColors[status.label]}`}
							>
								{status.label}
							</span>
							<span>{status.description}</span>
						</li>
					))}
				</ul>
			</div>
		</div>
	);

	return <Explainer text={explainerContent} maxWidth={520} />;
}
